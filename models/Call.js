
//backend/models/call.js 

import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      default: "audio",
    },
    offer: {
      type: mongoose.Schema.Types.Mixed, // Store SDP offer
      required: true,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed, // Store SDP answer
      default: null,
    },
    status: {
      type: String,
      enum: ["calling", "answered", "rejected", "ended", "missed"],
      default: "calling",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate duration before saving
callSchema.pre("save", function (next) {
  if (this.endedAt && this.answeredAt) {
    this.duration = Math.floor((this.endedAt - this.answeredAt) / 1000);
  }
  next();
});

// Index for faster queries
callSchema.index({ conversationId: 1, createdAt: -1 });
callSchema.index({ caller: 1, receiver: 1 });
callSchema.index({ status: 1 });

const Call = mongoose.model("Call", callSchema);

export default Call;