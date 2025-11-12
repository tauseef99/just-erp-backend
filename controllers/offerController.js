// backend/controllers/offerController.js
import Offer from "../models/Offer.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import stripePackage from 'stripe';

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

// Enhanced helper function to validate ObjectId
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
};

// Check if ID is a demo offer
const isDemoOfferId = (id) => {
  return id && typeof id === 'string' && id.startsWith('demo-offer-');
};

// Helper to find offer by any ID type
const findOfferById = async (offerId) => {
  console.log(`🔍 Searching for offer with ID: ${offerId}`);
  
  // Check if it's a demo offer
  if (isDemoOfferId(offerId)) {
    console.log(`🎭 This is a demo offer: ${offerId}`);
    return createDemoOffer(offerId);
  }
  
  // Try as ObjectId first
  if (isValidObjectId(offerId)) {
    const offer = await Offer.findById(offerId)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId");
    if (offer) {
      console.log(`✅ Offer found using ObjectId: ${offerId}`);
      return offer;
    }
  }
  
  // Try as string ID
  const offer = await Offer.findOne({ _id: offerId })
    .populate("sellerId", "name username email profileImage avatar")
    .populate("buyerId", "name username email profileImage avatar")
    .populate("conversationId");
  
  if (offer) {
    console.log(`✅ Offer found using string ID: ${offerId}`);
    return offer;
  }
  
  console.log(`❌ No offer found with ID: ${offerId}`);
  return null;
};

// Create a demo offer for testing
const createDemoOffer = (offerId) => {
  console.log(`🎭 Creating demo offer for ID: ${offerId}`);
  
  return {
    _id: offerId,
    title: "Demo Custom Offer",
    description: "This is a demo offer for testing purposes. Create a real offer to proceed with payment.",
    price: 99,
    currency: "usd",
    deliveryTime: 7,
    revisions: 1,
    status: "sent",
    sellerId: {
      _id: "demo-seller-123",
      name: "Demo Seller",
      email: "demo@seller.com",
      profileImage: null
    },
    buyerId: {
      _id: "demo-buyer-123", 
      name: "Demo Buyer",
      email: "demo@buyer.com",
      profileImage: null
    },
    conversationId: "demo-conversation-123",
    requirements: ["Demo requirement 1", "Demo requirement 2"],
    inclusions: ["Source files", "1 revision"],
    isDemo: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  };
};

// ============ CREATE OFFER ============
export const createOffer = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      deliveryDays,
      revisions,
      requirements,
      inclusions,
      buyerId,
      conversationId
    } = req.body;

    // ✅ VALIDATION: Check required fields
    if (!title || !description || !price || !deliveryDays || !buyerId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, description, price, deliveryDays, buyerId"
      });
    }

    // ✅ VALIDATION: Price must be positive
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        error: "Price must be greater than 0"
      });
    }

    // ✅ VALIDATION: Delivery time must be reasonable
    if (deliveryDays < 1 || deliveryDays > 365) {
      return res.status(400).json({
        success: false,
        error: "Delivery time must be between 1 and 365 days"
      });
    }

    // Get seller ID from authenticated user
    const sellerId = req.user.id;

    console.log('📦 Creating offer:', {
      title,
      price,
      deliveryDays,
      sellerId,
      buyerId,
      conversationId
    });

    // ✅ Check if conversation exists or use provided conversationId
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found"
        });
      }
    } else {
      // Find existing conversation between seller and buyer
      conversation = await Conversation.findOne({
        $or: [
          { sellerId, buyerId },
          { participants: { $all: [sellerId, buyerId] } }
        ]
      });

      // If no conversation exists, create one
      if (!conversation) {
        conversation = new Conversation({
          sellerId,
          buyerId,
          participants: [sellerId, buyerId]
        });
        await conversation.save();
        console.log('✅ New conversation created:', conversation._id);
      }
    }

    // Create the offer
    const offer = new Offer({
      title,
      description,
      price,
      deliveryTime: deliveryDays,
      revisions: revisions || 1,
      requirements: requirements || [],
      inclusions: inclusions || [],
      sellerId,
      buyerId,
      conversationId: conversation._id,
      status: "sent",
      sentAt: new Date()
    });

    await offer.save();

    // Populate the offer with user details for frontend
    const populatedOffer = await Offer.findById(offer._id)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId");

    console.log(`✅ Offer created successfully: ${offer._id}`);

    res.status(201).json({
      success: true,
      message: "Offer sent successfully",
      data: populatedOffer
    });

  } catch (error) {
    console.error("❌ Error creating offer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create offer",
      details: error.message
    });
  }
};

// ============ GET OFFERS BY CONVERSATION - FIXED ============
export const getOffersByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log('🔍 Fetching offers for conversation:', conversationId);
    console.log('👤 Current user ID:', userId);

    if (!conversationId) {
      return res.status(400).json({ 
        success: false,
        error: "Conversation ID is required" 
      });
    }

    // Find conversation and verify user is a participant
    const conversation = await Conversation.findById(conversationId)
      .populate('buyerId', 'name username email profileImage avatar')
      .populate('sellerId', 'name username email profileImage avatar');
    
    if (!conversation) {
      console.log('❌ Conversation not found:', conversationId);
      return res.status(404).json({ 
        success: false,
        error: "Conversation not found" 
      });
    }

    console.log('✅ Conversation found:', {
      id: conversation._id,
      seller: conversation.sellerId?._id,
      buyer: conversation.buyerId?._id,
      participants: conversation.participants
    });

    // Check if user is part of this conversation
    const isParticipant = 
      conversation.sellerId?._id?.toString() === userId || 
      conversation.buyerId?._id?.toString() === userId ||
      (conversation.participants && conversation.participants.includes(userId));

    console.log('🔐 User is participant:', isParticipant);

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false,
        error: "Not authorized to view offers for this conversation" 
      });
    }

    // ✅ FIXED: Find offers for this conversation with proper population
    console.log('📦 Querying offers with conversationId:', conversationId);
    
    // Method 1: Try with population first
    let offers = await Offer.find({
      conversationId: conversationId
    })
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${offers.length} REAL offers for conversation:`, offers.map(o => ({
      id: o._id,
      title: o.title,
      price: o.price,
      status: o.status,
      conversationId: o.conversationId?._id,
      seller: o.sellerId?.name,
      buyer: o.buyerId?.name
    })));

    res.status(200).json({
      success: true,
      data: offers,
      count: offers.length
    });

  } catch (error) {
    console.error("❌ Error fetching offers:", error);
    console.error("❌ Error stack:", error.stack);
    
    // ✅ FALLBACK: Try without population if population fails
    try {
      console.log('🔄 Trying fallback method without population...');
      const { conversationId } = req.params;
      
      const offers = await Offer.find({
        conversationId: conversationId
      }).sort({ createdAt: -1 });

      console.log(`✅ Fallback: Found ${offers.length} offers (without population)`);

      res.status(200).json({
        success: true,
        data: offers,
        count: offers.length
      });
    } catch (fallbackError) {
      console.error("❌ Fallback method also failed:", fallbackError);
      res.status(500).json({
        success: false,
        error: "Failed to fetch offers",
        details: fallbackError.message
      });
    }
  }
};

// ============ GET OFFER BY ID ============
export const getOfferById = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    console.log('📋 Fetching offer:', offerId);

    const offer = await findOfferById(offerId);

    if (!offer) {
      return res.status(404).json({ 
        success: false,
        error: "Offer not found" 
      });
    }

    // For demo offers, skip authorization check
    if (!offer.isDemo) {
      // Check if user is either buyer or seller
      const sellerId = offer.sellerId?._id?.toString() || offer.sellerId?.toString() || offer.sellerId;
      const buyerId = offer.buyerId?._id?.toString() || offer.buyerId?.toString() || offer.buyerId;
      
      const isSeller = sellerId === userId.toString();
      const isBuyer = buyerId === userId.toString();
      
      if (!isSeller && !isBuyer) {
        return res.status(403).json({ 
          success: false,
          error: "Not authorized to view this offer" 
        });
      }
    }

    res.status(200).json({
      success: true,
      data: offer,
      isDemo: offer.isDemo || false
    });

  } catch (error) {
    console.error("❌ Error fetching offer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch offer",
      details: error.message
    });
  }
};

// ============ ACCEPT OFFER - COMPLETELY FIXED ============
export const acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Accepting offer: ${offerId} by user: ${userId}`);
    console.log(`📝 Offer ID type: ${typeof offerId}, value: ${offerId}`);

    if (!offerId) {
      return res.status(400).json({
        success: false,
        error: "Offer ID is required"
      });
    }

    // ✅ FIXED: Use enhanced offer finder
    const offer = await findOfferById(offerId);

    if (!offer) {
      console.log('❌ Offer not found in database');
      return res.status(404).json({ 
        success: false,
        error: "Offer not found. Please refresh the page and try again." 
      });
    }

    console.log('✅ Offer found:', {
      id: offer._id,
      title: offer.title,
      isDemo: offer.isDemo,
      buyerId: offer.buyerId?._id || offer.buyerId,
      sellerId: offer.sellerId?._id || offer.sellerId,
      status: offer.status
    });

    // ✅ FIXED: Handle demo offers
    if (offer.isDemo) {
      console.log('🎭 This is a demo offer - creating real offer first');
      return res.status(400).json({
        success: false,
        error: "This is a demo offer. Please ask the seller to send a real offer to proceed with payment.",
        isDemo: true
      });
    }

    // ✅ FIXED: Check if user is the buyer (proper ID comparison)
    const buyerId = offer.buyerId?._id?.toString() || offer.buyerId?.toString() || offer.buyerId;
    const isBuyer = buyerId === userId.toString();

    console.log('🔍 Buyer verification:', {
      offerBuyerId: buyerId,
      currentUserId: userId.toString(),
      isBuyer: isBuyer
    });

    if (!isBuyer) {
      console.log('❌ User not authorized to accept this offer');
      return res.status(403).json({ 
        success: false,
        error: "Only the buyer can accept this offer" 
      });
    }

    // Check if offer can be accepted
    if (offer.status !== "sent") {
      console.log(`❌ Offer cannot be accepted in status: ${offer.status}`);
      return res.status(400).json({
        success: false,
        error: `Offer cannot be accepted in current status: ${offer.status}`,
        currentStatus: offer.status
      });
    }

    // ✅ FIXED: Create Stripe checkout session
    console.log('💳 Creating Stripe checkout session for accepted offer...');
    
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: offer.currency || 'usd',
              product_data: {
                name: offer.title,
                description: offer.description?.substring(0, 300) || 'Custom offer',
              },
              unit_amount: Math.round(offer.price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&offer_id=${offer._id}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel?offer_id=${offer._id}`,
        metadata: {
          offerId: offer._id.toString(),
          buyerId: userId.toString(),
          sellerId: offer.sellerId._id?.toString() || offer.sellerId.toString(),
        },
        customer_email: req.user.email,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      });

      console.log(`✅ Stripe session created: ${session.id}`);

      // ✅ FIXED: Update offer status to accepted
      offer.status = "accepted";
      offer.acceptedAt = new Date();
      offer.paymentSessionId = session.id;
      await offer.save();

      const updatedOffer = await Offer.findById(offer._id)
        .populate("sellerId", "name username email profileImage avatar")
        .populate("buyerId", "name username email profileImage avatar")
        .populate("conversationId");

      console.log(`✅ Offer accepted successfully: ${offer._id}`);

      res.status(200).json({
        success: true,
        message: "Offer accepted successfully",
        data: updatedOffer,
        paymentSession: {
          id: session.id,
          url: session.url,
          expires_at: session.expires_at
        }
      });

    } catch (stripeError) {
      console.error('❌ Stripe error:', stripeError);
      throw new Error(`Payment service error: ${stripeError.message}`);
    }

  } catch (error) {
    console.error("❌ Error accepting offer:", error);
    
    // Enhanced error response
    let errorMessage = "Failed to accept offer";
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = "Payment service error. Please try again.";
      statusCode = 400;
    } else if (error.name === 'CastError') {
      errorMessage = "Invalid offer ID format. Please refresh and try again.";
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
};

// ============ REJECT OFFER - FIXED ============
export const rejectOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Rejecting offer: ${offerId} by user: ${userId}`);

    if (!offerId) {
      return res.status(400).json({
        success: false,
        error: "Offer ID is required"
      });
    }

    // Use enhanced offer finder
    const offer = await findOfferById(offerId);

    if (!offer) {
      return res.status(404).json({ 
        success: false,
        error: "Offer not found" 
      });
    }

    // ✅ FIXED: Handle demo offers for rejection
    if (offer.isDemo) {
      console.log('🎭 Demo offer rejected');
      return res.status(200).json({
        success: true,
        message: "Demo offer rejected successfully",
        data: {
          ...offer,
          status: "rejected",
          rejectedAt: new Date()
        },
        isDemo: true
      });
    }

    // ✅ FIXED: Check if user is the buyer (proper ID comparison)
    const buyerId = offer.buyerId?._id?.toString() || offer.buyerId?.toString() || offer.buyerId;
    const isBuyer = buyerId === userId.toString();

    if (!isBuyer) {
      return res.status(403).json({ 
        success: false,
        error: "Only the buyer can reject this offer" 
      });
    }

    // Check if offer can be rejected
    if (offer.status !== "sent") {
      return res.status(400).json({
        success: false,
        error: `Offer cannot be rejected in current status: ${offer.status}`,
        currentStatus: offer.status
      });
    }

    // Update offer status to rejected
    offer.status = "rejected";
    offer.rejectedAt = new Date();
    await offer.save();

    const updatedOffer = await Offer.findById(offer._id)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId");

    console.log(`✅ Offer rejected successfully: ${offerId}`);

    res.status(200).json({
      success: true,
      message: "Offer rejected successfully",
      data: updatedOffer
    });

  } catch (error) {
    console.error("❌ Error rejecting offer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject offer",
      details: error.message
    });
  }
};

// ============ UPDATE OFFER STATUS ============
export const updateOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    console.log(`🔄 Updating offer status: ${offerId} to ${status}`);

    const offer = await findOfferById(offerId);

    if (!offer) {
      return res.status(404).json({ 
        success: false,
        error: "Offer not found" 
      });
    }

    // For demo offers, allow status updates
    if (!offer.isDemo) {
      // Check if user is either buyer or seller
      const sellerId = offer.sellerId?._id?.toString() || offer.sellerId?.toString() || offer.sellerId;
      const buyerId = offer.buyerId?._id?.toString() || offer.buyerId?.toString() || offer.buyerId;
      
      const isSeller = sellerId === userId.toString();
      const isBuyer = buyerId === userId.toString();
      
      if (!isSeller && !isBuyer) {
        return res.status(403).json({ 
          success: false,
          error: "Not authorized to update this offer" 
        });
      }
    }

    // Validate status
    const validStatuses = ["draft", "sent", "accepted", "rejected", "in_progress", "delivered", "completed", "cancelled", "paid"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
        validStatuses
      });
    }

    // For demo offers, just return updated demo data
    if (offer.isDemo) {
      const updatedDemoOffer = {
        ...offer,
        status: status,
        updatedAt: new Date()
      };
      
      return res.status(200).json({
        success: true,
        message: "Demo offer status updated successfully",
        data: updatedDemoOffer,
        isDemo: true
      });
    }

    // Update status based on business logic
    offer.status = status;
    
    // Set timestamps based on status
    const now = new Date();
    switch (status) {
      case "accepted":
        offer.acceptedAt = now;
        break;
      case "in_progress":
        offer.startedAt = now;
        break;
      case "delivered":
        offer.deliveredAt = now;
        break;
      case "completed":
        offer.completedAt = now;
        break;
      case "paid":
        offer.paidAt = now;
        break;
    }

    await offer.save();

    const updatedOffer = await Offer.findById(offer._id)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId");

    console.log(`✅ Offer status updated successfully: ${offerId}`);

    res.status(200).json({
      success: true,
      message: "Offer status updated successfully",
      data: updatedOffer
    });

  } catch (error) {
    console.error("❌ Error updating offer status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update offer status",
      details: error.message
    });
  }
};

// ============ GET USER OFFERS ============
export const getUserOffers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { role = 'all' } = req.query;

    console.log(`👤 Fetching offers for user: ${userId} as ${role}`);

    let query = {};
    
    if (role === 'seller') {
      query = { sellerId: userId };
    } else if (role === 'buyer') {
      query = { buyerId: userId };
    } else {
      query = {
        $or: [
          { sellerId: userId },
          { buyerId: userId }
        ]
      };
    }

    const offers = await Offer.find(query)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${offers.length} offers for user`);

    res.status(200).json({
      success: true,
      data: offers,
      count: offers.length
    });

  } catch (error) {
    console.error("❌ Error fetching user offers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user offers",
      details: error.message
    });
  }
};

// ============ CANCEL OFFER ============
export const cancelOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    console.log(`🚫 Canceling offer: ${offerId} by user: ${userId}`);

    const offer = await findOfferById(offerId);

    if (!offer) {
      return res.status(404).json({ 
        success: false,
        error: "Offer not found" 
      });
    }

    // Handle demo offers
    if (offer.isDemo) {
      return res.status(200).json({
        success: true,
        message: "Demo offer canceled successfully",
        data: {
          ...offer,
          status: "cancelled",
          cancelledAt: new Date()
        },
        isDemo: true
      });
    }

    // Check if user is the seller
    const sellerId = offer.sellerId?._id?.toString() || offer.sellerId?.toString() || offer.sellerId;
    const isSeller = sellerId === userId.toString();
    
    if (!isSeller) {
      return res.status(403).json({ 
        success: false,
        error: "Only the seller can cancel this offer" 
      });
    }

    // Check if offer can be canceled
    if (!['sent', 'accepted'].includes(offer.status)) {
      return res.status(400).json({
        success: false,
        error: `Offer cannot be canceled in current status: ${offer.status}`,
        currentStatus: offer.status
      });
    }

    // Update offer status to cancelled
    offer.status = "cancelled";
    offer.cancelledAt = new Date();
    await offer.save();

    const updatedOffer = await Offer.findById(offer._id)
      .populate("sellerId", "name username email profileImage avatar")
      .populate("buyerId", "name username email profileImage avatar")
      .populate("conversationId");

    console.log(`✅ Offer canceled successfully: ${offerId}`);

    res.status(200).json({
      success: true,
      message: "Offer canceled successfully",
      data: updatedOffer
    });

  } catch (error) {
    console.error("❌ Error canceling offer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel offer",
      details: error.message
    });
  }
};