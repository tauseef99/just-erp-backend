// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["buyer", "seller", "admin"],
      default: ["buyer"],
    },

    // Email verification fields
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null },
    verificationCodeExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
