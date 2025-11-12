import express from "express";
import { 
  getBuyerProfile, 
  updateBuyerProfile, 
  uploadProfileImage 
} from "../controllers/buyerProfileController.js";
import upload from "../middleware/upload.js";
import { auth, allow } from "../middleware/auth.js";

const router = express.Router();

// Get buyer profile
router.get("/", auth, allow(["buyer", "admin"]), getBuyerProfile);

// Update buyer profile
router.put("/", auth, allow(["buyer", "admin"]), updateBuyerProfile);

// Upload profile image
router.post("/upload-image", auth, allow(["buyer", "admin"]), upload.single("profileImage"), uploadProfileImage);

export default router;