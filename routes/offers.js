//backend/routes/offers.js
import express from "express";
import { 
  createOffer, 
  getOffersByConversation, 
  getOfferById, 
  acceptOffer, 
  rejectOffer,
  updateOfferStatus
} from "../controllers/offerController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.post("/create", auth, createOffer);
router.get("/conversation/:conversationId", auth, getOffersByConversation);
router.get("/:offerId", auth, getOfferById);
router.patch("/:offerId/accept", auth, acceptOffer);
router.patch("/:offerId/reject", auth, rejectOffer);
router.patch("/:offerId/status", auth, updateOfferStatus);

export default router;