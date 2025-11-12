//backend/models/Conversatoin.js

import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      type: String,
      default: "Conversation started",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    orderTitle: {
      type: String,
      default: "New Project",
    },
    status: {
      type: String,
      enum: ["active", "archived", "completed"],
      default: "active",
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one conversation per buyer-seller pair
conversationSchema.index({ buyer: 1, seller: 1 }, { unique: true });

// Add text index for search
conversationSchema.index({ 
  "buyer.name": "text", 
  "seller.name": "text", 
  "lastMessage": "text" 
});

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;