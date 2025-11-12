// routes/profileWizard.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getProfileWizardData,
  updateProfileWizardStep,
  generateTagline
} from "../controllers/profileWizardController.js";

const router = express.Router();

// Get profile wizard data
router.get("/", auth, getProfileWizardData);

// Update profile wizard step
router.put("/step", auth, updateProfileWizardStep);

// Generate tagline - CHANGED TO POST since it modifies data
router.post("/tagline", auth, generateTagline);

export default router;