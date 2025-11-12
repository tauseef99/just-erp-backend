// backend/models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "usd" },
  status: { type: String, enum: ["pending", "succeeded", "failed"], default: "pending" },
  stripePaymentIntentId: { type: String },
  checkoutSessionId: { type: String } // 🔹 added for Stripe Checkout
}, { timestamps: true });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
