// backend/routes/payment.js
import express from "express";
import { 
  createCheckoutSession, 
  stripeWebhook,
  getPaymentStatus,
  getPaymentByOfferId,
  getUserPayments,
  refundPayment
} from "../controllers/paymentController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Webhook (must be before JSON middleware in server.js)
router.post("/webhook", stripeWebhook);

// Protected routes
router.post("/create-checkout-session", auth, createCheckoutSession);
router.get("/status/:sessionId", auth, getPaymentStatus);
router.get("/offer/:offerId", auth, getPaymentByOfferId);
router.get("/user-payments", auth, getUserPayments);
router.post("/refund/:paymentId", auth, refundPayment);

export default router;