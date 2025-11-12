// backend/models/Offer.js
import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  // Basic Offer Information
  title: {
    type: String,
    required: [true, "Offer title is required"],
    trim: true,
    maxlength: [100, "Title cannot exceed 100 characters"]
  },
  description: {
    type: String,
    required: [true, "Offer description is required"],
    maxlength: [1000, "Description cannot exceed 1000 characters"]
  },

  // Conversation reference
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: [true, "Conversation ID is required"]
  },

  // Parties Involved
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Seller ID is required"]
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Buyer ID is required"]
  },

  // Pricing & Delivery
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [1, "Price must be at least $1"]
  },
  currency: {
    type: String,
    default: "usd",
    enum: ["usd", "eur", "gbp", "cad", "aud"]
  },
  deliveryTime: {
    type: Number, // Number of days
    required: [true, "Delivery time is required"],
    min: [1, "Delivery time must be at least 1 day"]
  },

  // Payment session ID for Stripe
  paymentSessionId: {
    type: String
  },

  // Offer Specifications
  requirements: [{
    type: String,
    trim: true
  }],
  inclusions: [{
    type: String,
    trim: true
  }],
  revisions: {
    type: Number,
    default: 1,
    min: [0, "Revisions cannot be negative"]
  },

  // Status & Timeline
  status: {
    type: String,
    enum: ["draft", "sent", "accepted", "rejected", "in_progress", "delivered", "completed", "cancelled", "disputed", "paid"],
    default: "draft"
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Offer expires in 7 days if not specified
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },

  // Timestamps for key events
  sentAt: {
    type: Date
  },
  acceptedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },

  // Communication & Files
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    attachments: [{
      filename: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Delivery & Work
  deliveredWork: {
    files: [{
      filename: String,
      url: String,
      description: String,
      deliveredAt: {
        type: Date,
        default: Date.now
      }
    }],
    message: String,
    deliveredAt: Date
  },

  // Review & Rating
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },

  // Dispute Information
  dispute: {
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reason: {
      type: String,
      enum: ["quality", "late_delivery", "not_as_described", "other"]
    },
    description: String,
    raisedAt: Date,
    resolvedAt: Date,
    resolution: {
      type: String,
      enum: ["refund_buyer", "pay_seller", "partial_refund", "cancelled"]
    }
  }

}, { 
  timestamps: true,
  strictPopulate: false // ✅ FIX: Added to resolve populate errors
});

// Indexes for better performance
offerSchema.index({ sellerId: 1, status: 1 });
offerSchema.index({ buyerId: 1, status: 1 });
offerSchema.index({ conversationId: 1 }); // Index for conversation queries
offerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-remove expired offers
offerSchema.index({ createdAt: -1 });

// Virtual for checking if offer is expired
offerSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for checking if offer can be accepted
offerSchema.virtual('canBeAccepted').get(function() {
  return this.status === "sent" && !this.isExpired;
});

// Method to send offer
offerSchema.methods.sendOffer = function() {
  this.status = "sent";
  this.sentAt = new Date();
  return this.save();
};

// Method to accept offer
offerSchema.methods.acceptOffer = function() {
  const isExpired = this.expiresAt && this.expiresAt < new Date();
  
  if (this.status === "sent" && !isExpired) {
    this.status = "accepted";
    this.acceptedAt = new Date();
    return this.save();
  }
  throw new Error("Offer cannot be accepted (Status is not 'sent' or offer is expired)");
};

// Method to reject offer
offerSchema.methods.rejectOffer = function() {
  if (this.status === "sent") {
    this.status = "rejected";
    this.rejectedAt = new Date();
    return this.save();
  }
  throw new Error("Offer cannot be rejected");
};

// Method to start work
offerSchema.methods.startWork = function() {
  if (this.status === "accepted") {
    this.status = "in_progress";
    this.startedAt = new Date();
    return this.save();
  }
  throw new Error("Work cannot be started in current status");
};

// Method to deliver work
offerSchema.methods.deliverWork = function(files, message) {
  if (this.status === "in_progress") {
    this.status = "delivered";
    this.deliveredWork = {
      files: files,
      message: message,
      deliveredAt: new Date()
    };
    this.deliveredAt = new Date();
    return this.save();
  }
  throw new Error("Work cannot be delivered in current status");
};

// Method to complete order
offerSchema.methods.completeOrder = function() {
  if (this.status === "delivered") {
    this.status = "completed";
    this.completedAt = new Date();
    return this.save();
  }
  throw new Error("Order cannot be completed in current status");
};

// Static method to find active offers for a user
offerSchema.statics.findActiveOffers = function(userId) {
  return this.find({
    $or: [{ sellerId: userId }, { buyerId: userId }],
    status: { $in: ["sent", "accepted", "in_progress", "delivered"] }
  })
  .populate("sellerId", "name email avatar")
  .populate("buyerId", "name email avatar")
  .populate("conversationId");
};

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;