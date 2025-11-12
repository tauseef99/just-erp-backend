//backend//routes/messages.js
import express from "express";
import * as messageController from "../controllers/messageController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(auth);

// Fixed routes with proper structure
router.post("/conversation", messageController.getOrCreateConversation);
router.get("/conversations", messageController.getUserConversations);
router.get("/:conversationId", messageController.getMessages);
router.post("/send", messageController.sendMessage);
router.put("/read", messageController.markAsRead);

export default router;