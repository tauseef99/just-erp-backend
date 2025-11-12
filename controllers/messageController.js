// backend/controllers/MessageController.js
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Seller from "../models/Seller.js";

// Create or get conversation - COMPLETELY FIXED
export const getOrCreateConversation = async (req, res) => {
  try {
    const { buyerId, sellerId } = req.body;
    const userId = req.user.id;

    console.log('🔄 Creating conversation:', { buyerId, sellerId, userId });

    // Validate input
    if (!buyerId || !sellerId) {
      return res.status(400).json({ 
        message: "Missing required fields: buyerId and sellerId" 
      });
    }

    // Verify user has access to this conversation
    if (userId.toString() !== buyerId.toString()) {
      return res.status(403).json({ 
        message: "Access denied: Only buyer can initiate conversation",
        userId,
        buyerId,
        sellerId
      });
    }

    // Verify buyer exists
    const buyer = await User.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // Check if seller exists as User first
    let sellerUser = await User.findById(sellerId);
    
    if (!sellerUser) {
      console.log('🔄 Seller not found as User, checking Seller collection...');
      
      // Try to find the seller in Seller collection and get their userId
      const sellerProfile = await Seller.findById(sellerId);
      
      if (sellerProfile && sellerProfile.userId) {
        console.log('✅ Found seller profile, using actual user ID:', sellerProfile.userId);
        sellerUser = await User.findById(sellerProfile.userId);
        
        if (!sellerUser) {
          return res.status(404).json({ 
            message: "Seller user account not found",
            sellerId: sellerProfile.userId 
          });
        }
        
        // Use the actual user ID for conversation creation
        sellerId = sellerProfile.userId.toString();
      } else {
        return res.status(404).json({ 
          message: "Seller not found in database",
          sellerId 
        });
      }
    }

    console.log('✅ Both buyer and seller verified');

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      $or: [
        { buyer: buyerId, seller: sellerId },
        { buyer: sellerId, seller: buyerId }
      ]
    })
    .populate("buyer", "name email profileImage username firstName lastName")
    .populate("seller", "name email profileImage username firstName lastName");

    if (!conversation) {
      console.log('📝 Creating new conversation');
      
      // Create new conversation
      conversation = new Conversation({
        participants: [buyerId, sellerId],
        buyer: buyerId,
        seller: sellerId,
        lastMessage: "Conversation started",
        lastMessageAt: new Date(),
        orderTitle: "New Project Discussion",
        unreadCount: 0
      });
      
      await conversation.save();

      // Populate after save
      conversation = await Conversation.findById(conversation._id)
        .populate("buyer", "name email profileImage username firstName lastName")
        .populate("seller", "name email profileImage username firstName lastName");

      console.log('✅ New conversation created:', conversation._id);
    } else {
      console.log('✅ Existing conversation found:', conversation._id);
    }

    res.json(conversation);
  } catch (error) {
    console.error('❌ Error in getOrCreateConversation:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Get user conversations - FIXED
export const getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📂 Getting conversations for user:', userId);

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate("buyer", "name email profileImage username firstName lastName")
    .populate("seller", "name email profileImage username firstName lastName")
    .sort({ lastMessageAt: -1 });

    // Format conversations properly
    const formattedConversations = conversations.map(conv => {
      const isBuyer = conv.buyer._id.toString() === userId.toString();
      
      return {
        _id: conv._id,
        seller: isBuyer ? conv.seller : conv.buyer,
        buyer: conv.buyer,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        orderTitle: conv.orderTitle,
        status: conv.status,
        unreadCount: conv.unreadCount || 0,
        participants: conv.participants,
        // Add additional fields for frontend
        otherUser: isBuyer ? conv.seller : conv.buyer
      };
    });

    console.log(`✅ Found ${formattedConversations.length} conversations`);
    
    res.json(formattedConversations);
  } catch (error) {
    console.error('❌ Error in getUserConversations:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get messages for a conversation - FIXED
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log('💬 Getting messages for conversation:', conversationId);

    // Verify user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: "Access denied to this conversation" });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName")
      .sort({ createdAt: 1 });

    console.log(`✅ Found ${messages.length} messages`);

    // Mark messages as read for current user
    await Message.updateMany(
      { 
        conversationId, 
        receiver: userId, 
        isRead: false 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    // Update conversation unread count for this user
    const unreadCount = await Message.countDocuments({
      conversationId,
      receiver: userId,
      isRead: false
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount
    });

    res.json(messages);
  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Send message - COMPLETELY FIXED
export const sendMessage = async (req, res) => {
  try {
    const { conversationId, receiverId, message } = req.body;
    const senderId = req.user.id;

    console.log('📤 Sending message:', { conversationId, receiverId, senderId, message });

    if (!conversationId || !receiverId || !message) {
      return res.status(400).json({ 
        message: "Missing required fields: conversationId, receiverId, message" 
      });
    }

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId)
      .populate("buyer", "name email profileImage username firstName lastName")
      .populate("seller", "name email profileImage username firstName lastName");

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.participants.includes(senderId)) {
      return res.status(403).json({ message: "Access denied to this conversation" });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Create new message
    const newMessage = new Message({
      conversationId,
      sender: senderId,
      receiver: receiverId,
      message: message.trim(),
      messageType: "text"
    });

    await newMessage.save();
    console.log('✅ Message saved:', newMessage._id);

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message,
      lastMessageAt: new Date(),
      $inc: { unreadCount: 1 }
    });

    // Populate the message with sender info
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name profileImage username firstName lastName")
      .populate("receiver", "name profileImage username firstName lastName");

    console.log('✅ Message populated with sender info');

    // Emit socket events - FIXED
    if (req.io) {
      // Emit to receiver's personal room
      req.io.to(receiverId.toString()).emit("newMessage", populatedMessage);
      
      // Emit to conversation room for all participants
      req.io.to(conversationId.toString()).emit("newMessage", populatedMessage);
      
      // Emit conversation update to all participants
      conversation.participants.forEach(participantId => {
        req.io.to(participantId.toString()).emit("conversationUpdated");
      });

      console.log('📡 Socket events emitted to:', {
        receiver: receiverId,
        conversation: conversationId,
        participants: conversation.participants
      });
    } else {
      console.log('Socket.io not available in request');
    }


    res.json(populatedMessage);
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: error.stack 
    });
  }
};


export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    console.log('👀 Marking messages as read:', { conversationId, userId });

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    await Message.updateMany(
      { conversationId, receiver: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Reset unread count for this user in conversation
    const unreadCount = await Message.countDocuments({
      conversationId,
      receiver: userId,
      isRead: false
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount
    });

    console.log('✅ Messages marked as read');
    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error('❌ Error in markAsRead:', error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};