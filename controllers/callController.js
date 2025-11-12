//backend/Controller/callController.js 
import Call from "../models/Call.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

// Create call offer
export const createCallOffer = async (req, res) => {
  try {
    const { conversationId, callType, offer } = req.body;
    const callerId = req.user.id;

    console.log('📞 Creating call offer:', { conversationId, callType, callerId });

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.participants.includes(callerId)) {
      return res.status(403).json({ message: "Access denied to this conversation" });
    }

    // Get receiver (the other participant)
    const receiverId = conversation.participants.find(
      participant => participant.toString() !== callerId.toString()
    );

    if (!receiverId) {
      return res.status(400).json({ message: "No receiver found in conversation" });
    }

    // Create call record
    const call = new Call({
      conversationId,
      caller: callerId,
      receiver: receiverId,
      callType: callType || 'audio', // 'audio' or 'video'
      offer,
      status: 'calling'
    });

    await call.save();

    // Populate call with user data
    const populatedCall = await Call.findById(call._id)
      .populate("caller", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName");

    // Emit call event to receiver
    if (req.io) {
      req.io.to(receiverId.toString()).emit("incomingCall", {
        call: populatedCall,
        conversationId
      });
      
      console.log('📡 Emitted incoming call to:', receiverId);
    }

    res.json({
      message: "Call offer created",
      call: populatedCall
    });
  } catch (error) {
    console.error('❌ Error in createCallOffer:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Handle call answer
export const answerCall = async (req, res) => {
  try {
    const { callId, answer } = req.body;
    const userId = req.user.id;

    console.log('📞 Answering call:', { callId, userId });

    const call = await Call.findById(callId)
      .populate("caller", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName");

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Verify user is the receiver
    if (call.receiver._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only receiver can answer the call" });
    }

    // Update call status
    call.answer = answer;
    call.status = 'answered';
    call.answeredAt = new Date();
    await call.save();

    // Emit answer to caller
    if (req.io) {
      req.io.to(call.caller._id.toString()).emit("callAnswered", {
        callId: call._id,
        answer,
        receiver: call.receiver
      });

      // Notify both users that call is connected
      req.io.to(call.caller._id.toString()).emit("callConnected", { callId: call._id });
      req.io.to(call.receiver._id.toString()).emit("callConnected", { callId: call._id });

      console.log('📡 Emitted call answer to caller:', call.caller._id);
    }

    res.json({
      message: "Call answered",
      call
    });
  } catch (error) {
    console.error('❌ Error in answerCall:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Handle ICE candidate exchange
export const handleICECandidate = async (req, res) => {
  try {
    const { callId, candidate, targetUserId } = req.body;
    const userId = req.user.id;

    console.log('❄️ Handling ICE candidate:', { callId, targetUserId });

    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Verify user is participant in the call
    if (![call.caller.toString(), call.receiver.toString()].includes(userId.toString())) {
      return res.status(403).json({ message: "Not a participant in this call" });
    }

    // Send ICE candidate to the other user
    if (req.io) {
      req.io.to(targetUserId).emit("iceCandidate", {
        callId,
        candidate,
        fromUserId: userId
      });

      console.log('📡 Emitted ICE candidate to:', targetUserId);
    }

    res.json({ message: "ICE candidate forwarded" });
  } catch (error) {
    console.error('❌ Error in handleICECandidate:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// End call
export const endCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.id;

    console.log('📞 Ending call:', { callId, userId });

    const call = await Call.findById(callId)
      .populate("caller", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName");

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Verify user is participant in the call
    if (![call.caller._id.toString(), call.receiver._id.toString()].includes(userId.toString())) {
      return res.status(403).json({ message: "Not a participant in this call" });
    }

    // Update call status
    call.status = 'ended';
    call.endedAt = new Date();
    call.endedBy = userId;
    await call.save();

    // Notify both users that call has ended
    if (req.io) {
      const participants = [call.caller._id.toString(), call.receiver._id.toString()];
      
      participants.forEach(participantId => {
        req.io.to(participantId).emit("callEnded", {
          callId: call._id,
          endedBy: userId,
          duration: call.endedAt - call.createdAt
        });
      });

      console.log('📡 Emitted call ended to participants:', participants);
    }

    res.json({
      message: "Call ended",
      call
    });
  } catch (error) {
    console.error('❌ Error in endCall:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Reject call
export const rejectCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.id;

    console.log('📞 Rejecting call:', { callId, userId });

    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Verify user is the receiver
    if (call.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only receiver can reject the call" });
    }

    // Update call status
    call.status = 'rejected';
    call.endedAt = new Date();
    call.endedBy = userId;
    await call.save();

    // Notify caller that call was rejected
    if (req.io) {
      req.io.to(call.caller.toString()).emit("callRejected", {
        callId: call._id,
        rejectedBy: call.receiver
      });

      console.log('📡 Emitted call rejected to caller:', call.caller);
    }

    res.json({
      message: "Call rejected",
      call
    });
  } catch (error) {
    console.error('❌ Error in rejectCall:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get call history for conversation
export const getCallHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log('📋 Getting call history for conversation:', conversationId);

    // Verify user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: "Access denied to this conversation" });
    }

    const calls = await Call.find({ conversationId })
      .populate("caller", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      calls,
      total: calls.length
    });
  } catch (error) {
    console.error('❌ Error in getCallHistory:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};