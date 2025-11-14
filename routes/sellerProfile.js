//backend/routes/sellerProfile.js

import express from "express";
import { auth } from "../middleware/auth.js";
import upload, { handleUploadError } from "../middleware/upload.js";

import {
  getSellerProfile,
  updateSellerProfile,
  uploadProfileImage,
  uploadCertificate,
  getAllSellerProfiles
} from "../controllers/sellerProfileController.js";

const router = express.Router();

// Get seller profile - FIXED: removed auth middleware duplication
router.get("/", auth, getSellerProfile);

// Update seller profile
router.put("/", auth, updateSellerProfile);

// Upload profile image - CORRECT order
router.post(
  "/upload-image", 
  auth,
  upload.single("profileImage"),
  handleUploadError,
  uploadProfileImage
);

// Upload certificate
router.post(
  "/upload-certificate", 
  auth, 
  upload.single("certificate"), 
  handleUploadError,
  uploadCertificate
);

router.get('/all', getAllSellerProfiles);

router.get('/profiles/all', auth, getAllSellerProfiles);
// In your backend route for fetching all sellers
router.get('/profile/all', auth, async (req, res) => {
  try {
    const sellers = await Seller.find()
      .populate('userId', 'username email') 
      .select('-__v') // Exclude version key
      .lean(); // Convert to plain JavaScript object

    // Transform the data to match your frontend expectations
    const transformedSellers = sellers.map(seller => ({
      id: seller._id,
      title: seller.tagline || "ERP Specialist",
      provider: seller.username || "Seller",
      rating: seller.rating || 4.5,
      reviews: seller.reviewCount || 0,
      price: 100, // Default price or calculate based on services
      delivery: "1-2 days", // Default delivery time
      img: seller.profileImage ? `${process.env.REACT_APP_API_URL}/uploads/${seller.profileImage}` : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
      description: seller.about || seller.professionalSummary || "Experienced ERP professional",
      level: seller.level || "Level 2 ERP Specialist",
      location: seller.location || "Location not specified",
      
      // Include the detailed profile data
      professionalSummary: seller.professionalSummary,
      functionalRoles: seller.functionalRoles,
      technicalRoles: seller.technicalRoles,
      projects: seller.projects,
      technicalSkills: seller.technicalSkills,
      certifications: seller.certifications,
      servicesOffered: seller.servicesOffered,
      languages: seller.languages,
      specializations: seller.specializations,
      memberSince: seller.memberSince,
      avgResponseTime: seller.avgResponseTime,
      lastDelivery: seller.lastDelivery
    }));

    res.json(transformedSellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ message: 'Error fetching seller profiles' });
  }
});

export default router;