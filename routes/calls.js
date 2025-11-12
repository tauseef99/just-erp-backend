
//backend/routes/call.js
import express from "express";
import * as callController from "../controllers/callController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(auth);

// Call management routes
router.post("/offer", callController.createCallOffer);
router.post("/answer", callController.answerCall);
router.post("/ice-candidate", callController.handleICECandidate);
router.post("/end", callController.endCall);
router.post("/reject", callController.rejectCall);
router.get("/history/:conversationId", callController.getCallHistory);

export default router;