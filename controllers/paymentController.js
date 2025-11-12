// backend/controllers/paymentController.js
import Stripe from "stripe";
import Payment from "../models/Payment.js";
import Offer from "../models/Offer.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============ Create Checkout Session ============
export const createCheckoutSession = async (req, res) => {
  try {
    const { 
      amount, 
      currency, 
      offerId, 
      buyerId, 
      sellerId, 
      description = "Custom Offer Payment" 
    } = req.body;

    // ✅ VALIDATION: Check if required fields exist
    if (!amount || !offerId || !buyerId || !sellerId) {
      return res.status(400).json({ 
        error: "Missing required fields: amount, offerId, buyerId, sellerId" 
      });
    }

    // ✅ VALIDATE: Amount must be positive
    if (amount <= 0) {
      return res.status(400).json({ 
        error: "Amount must be greater than 0" 
      });
    }

    // ✅ VALIDATE OFFER EXISTS AND CAN BE PAID
    let offer;
    try {
      offer = await Offer.findById(offerId)
        .populate("sellerId", "name email")
        .populate("buyerId", "name email");

      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Validate offer status
      if (offer.status !== "accepted") {
        return res.status(400).json({ 
          error: "Offer must be accepted before payment",
          currentStatus: offer.status,
          allowedStatus: "accepted"
        });
      }

      // Validate buyer matches
      if (offer.buyerId._id.toString() !== buyerId) {
        return res.status(403).json({ 
          error: "Buyer does not match offer",
          offerBuyerId: offer.buyerId._id.toString(),
          providedBuyerId: buyerId
        });
      }

      // Validate seller matches
      if (offer.sellerId._id.toString() !== sellerId) {
        return res.status(403).json({ 
          error: "Seller does not match offer",
          offerSellerId: offer.sellerId._id.toString(),
          providedSellerId: sellerId
        });
      }

      // Validate amount matches offer price (allow small rounding differences)
      if (Math.abs(offer.price - amount) > 0.01) {
        return res.status(400).json({ 
          error: "Payment amount does not match offer price",
          offerPrice: offer.price,
          paymentAmount: amount 
        });
      }

      // Check if payment already exists for this offer
      const existingPayment = await Payment.findOne({ 
        offerId, 
        status: { $in: ["succeeded", "pending"] } 
      });
      
      if (existingPayment) {
        return res.status(400).json({ 
          error: "Payment already exists for this offer",
          paymentId: existingPayment._id,
          status: existingPayment.status
        });
      }

    } catch (error) {
      console.error("❌ Offer validation error:", error);
      return res.status(500).json({ error: "Error validating offer" });
    }

    // ✅ Create payment record in DB first
    const payment = new Payment({
      offerId,
      buyerId,
      sellerId,
      amount,
      currency: currency || "usd",
      status: "pending"
    });
    await payment.save();

    // ✅ Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency || "usd",
            product_data: {
              name: `Custom Offer: ${offer.title}`,
              description: description.substring(0, 300), // Stripe description limit
              metadata: {
                offerId: offerId,
                deliveryDays: offer.deliveryTime.toString()
              }
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      customer_email: offer.buyerId.email, // Pre-fill buyer email
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&offer_id=${offerId}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel?offer_id=${offerId}&payment_id=${payment._id}`,
      metadata: {
        paymentId: payment._id.toString(),
        offerId: offerId,
        buyerId: buyerId,
        sellerId: sellerId,
        offerTitle: offer.title
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // Session expires in 30 minutes
      payment_intent_data: {
        description: `Payment for offer: ${offer.title}`,
        metadata: {
          offerId: offerId,
          buyerId: buyerId,
          sellerId: sellerId
        }
      }
    });

    // ✅ Update payment with session ID and expiry
    payment.checkoutSessionId = session.id;
    payment.sessionExpiresAt = new Date(session.expires_at * 1000);
    await payment.save();

    console.log(`✅ Checkout session created for offer ${offerId}:`, session.id);

    res.status(200).json({ 
      success: true,
      id: session.id, 
      url: session.url,
      paymentId: payment._id,
      expiresAt: payment.sessionExpiresAt,
      message: "Checkout session created successfully"
    });

  } catch (error) {
    console.error("❌ Stripe session error:", error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: "Invalid payment request",
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to create checkout session",
      details: error.message 
    });
  }
};

// ============ Webhook Handler ============
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log(`✅ Webhook received: ${event.type}`);
    
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle different event types
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event.data.object);
        break;
        
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(event.data.object);
        break;
        
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(event.data.object);
        break;
        
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
        
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
        
      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true, handled: true });
    
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    res.status(500).json({ received: true, handled: false, error: error.message });
  }
};

// ============ WEBHOOK HANDLER FUNCTIONS ============

const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log(`✅ Payment completed for session: ${session.id}`);
    
    const payment = await Payment.findOne({ 
      checkoutSessionId: session.id 
    });
    
    if (payment) {
      payment.status = "succeeded";
      payment.stripePaymentIntentId = session.payment_intent;
      payment.paidAt = new Date();
      await payment.save();
      
      // Update offer status to "in_progress"
      await Offer.findByIdAndUpdate(
        payment.offerId,
        { 
          status: "in_progress",
          startedAt: new Date()
        }
      );
      
      console.log(`✅ Payment ${payment._id} marked as succeeded and offer set to in_progress`);
      
      // TODO: Send notifications to buyer and seller
      // await sendPaymentSuccessEmail(payment);
      
    } else {
      console.error(`❌ Payment not found for session: ${session.id}`);
    }
  } catch (error) {
    console.error("❌ Error handling completed session:", error);
    throw error;
  }
};

const handleCheckoutSessionExpired = async (session) => {
  try {
    await Payment.findOneAndUpdate(
      { checkoutSessionId: session.id },
      { 
        status: "expired",
        expiredAt: new Date()
      }
    );
    console.log(`❌ Payment session expired: ${session.id}`);
  } catch (error) {
    console.error("❌ Error updating expired session:", error);
  }
};

const handleAsyncPaymentSucceeded = async (session) => {
  try {
    await Payment.findOneAndUpdate(
      { checkoutSessionId: session.id },
      { 
        status: "succeeded",
        paidAt: new Date()
      }
    );
    console.log(`✅ Async payment succeeded: ${session.id}`);
  } catch (error) {
    console.error("❌ Error handling async payment success:", error);
  }
};

const handleAsyncPaymentFailed = async (session) => {
  try {
    await Payment.findOneAndUpdate(
      { checkoutSessionId: session.id },
      { 
        status: "failed",
        failedAt: new Date()
      }
    );
    console.log(`❌ Async payment failed: ${session.id}`);
  } catch (error) {
    console.error("❌ Error handling async payment failure:", error);
  }
};

const handlePaymentFailed = async (paymentIntent) => {
  try {
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { 
        status: "failed",
        failedAt: new Date(),
        failureReason: paymentIntent.last_payment_error?.message || "Unknown error"
      }
    );
    console.log(`❌ Payment failed: ${paymentIntent.id}`);
  } catch (error) {
    console.error("❌ Error updating failed payment:", error);
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { 
        status: "succeeded",
        paidAt: new Date()
      }
    );
    console.log(`✅ Payment intent succeeded: ${paymentIntent.id}`);
  } catch (error) {
    console.error("❌ Error handling payment intent success:", error);
  }
};

// ============ PAYMENT STATUS CHECK ============
export const getPaymentStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });

    // Find payment in database
    const payment = await Payment.findOne({ checkoutSessionId: sessionId })
      .populate("offerId", "title status deliveryTime")
      .populate("buyerId", "name email")
      .populate("sellerId", "name email");

    const response = {
      sessionId: session.id,
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
      dbStatus: payment?.status,
      amount: session.amount_total ? session.amount_total / 100 : null,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      paymentIntent: session.payment_intent,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      paymentDetails: payment,
      offerDetails: payment?.offerId
    };

    res.status(200).json(response);
    
  } catch (error) {
    console.error("❌ Error getting payment status:", error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.status(500).json({ error: error.message });
  }
};

// ============ GET PAYMENT BY OFFER ID ============
export const getPaymentByOfferId = async (req, res) => {
  try {
    const { offerId } = req.params;

    const payment = await Payment.findOne({ offerId })
      .populate("offerId", "title description price deliveryTime")
      .populate("buyerId", "name email avatar")
      .populate("sellerId", "name email avatar")
      .sort({ createdAt: -1 });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found for this offer" });
    }

    res.status(200).json({
      success: true,
      payment
    });

  } catch (error) {
    console.error("❌ Error fetching payment by offer ID:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ LIST USER PAYMENTS ============
export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { role, status, page = 1, limit = 10 } = req.query;

    let query = {};
    
    // Determine if user is buyer or seller
    if (role === 'buyer') {
      query.buyerId = userId;
    } else if (role === 'seller') {
      query.sellerId = userId;
    } else {
      // If no role specified, show all payments where user is either buyer or seller
      query.$or = [{ buyerId: userId }, { sellerId: userId }];
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "offerId", select: "title description deliveryTime" },
        { path: "buyerId", select: "name email avatar" },
        { path: "sellerId", select: "name email avatar" }
      ]
    };

    const payments = await Payment.find(query)
      .populate("offerId", "title description deliveryTime")
      .populate("buyerId", "name email avatar")
      .populate("sellerId", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPayments: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user payments:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ REFUND PAYMENT ============
export const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate("offerId", "status")
      .populate("sellerId", "id")
      .populate("buyerId", "id");

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Check if user has permission to refund (seller or admin)
    if (payment.sellerId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Not authorized to refund this payment" });
    }

    // Check if payment can be refunded
    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: "Only successful payments can be refunded" });
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      reason: reason || 'requested_by_customer'
    });

    // Update payment status
    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundId = refund.id;
    await payment.save();

    // Update offer status
    await Offer.findByIdAndUpdate(
      payment.offerId,
      { status: 'cancelled' }
    );

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      refundId: refund.id,
      refundStatus: refund.status
    });

  } catch (error) {
    console.error("❌ Error refunding payment:", error);
    res.status(500).json({ error: error.message });
  }
};