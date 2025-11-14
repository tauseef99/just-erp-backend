// backend/controllers/sellerProfileController.js
import Seller from "../models/Seller.js";
import User from "../models/User.js";

// Get seller profile
// Get seller profile
export const getSellerProfile = async (req, res) => {
  try {
    console.log("Fetching seller profile for user:", req.user.id);
    
    let seller = await Seller.findOne({ userId: req.user.id })
      .populate("userId", "username email firstName lastName");

    if (!seller) {
      console.log("No seller profile found, creating default");
      // Create a default seller profile if none exists
      seller = new Seller({
        userId: req.user.id,
        username: req.user.username || "New Seller",
        profileCompletion: 0
      });
      await seller.save();
    }

    console.log("Seller profile found:", seller);
    res.json(seller);
  } catch (error) {
    console.error("Error fetching seller profile:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update seller profile (basic info)
export const updateSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    if (req.file) {
      seller.profileImage = req.file.filename;
    }

    // update other profile fields if present
    Object.assign(seller, req.body);

    await seller.save();

    res.status(200).json({
      message: "Profile updated successfully",
      profileImage: seller.profileImage,
      seller, // return the full seller too if needed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Upload profile image only
// Upload profile image only
export const uploadProfileImage = async (req, res) => {
  try {
    console.log("Upload profile image request received");
    console.log("File:", req.file);
    console.log("User:", req.user);

    if (!req.file) {
      console.log("No file in request");
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Find seller or create if doesn't exist
    let seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      console.log("Creating new seller profile for user:", req.user.id);
      seller = new Seller({
        userId: req.user.id,
        username: req.user.username || "New Seller",
        profileImage: req.file.filename
      });
    } else {
      console.log("Updating existing seller profile");
      // Update profile image
      seller.profileImage = req.file.filename;
    }

    await seller.save();
    console.log("Profile image saved successfully:", req.file.filename);

    res.json({
      message: "Profile image uploaded successfully",
      profileImage: req.file.filename
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Upload certificate
export const uploadCertificate = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });

    if (!seller) {
      return res.status(404).json({ message: "Seller profile not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    seller.certifications.push({
      title: req.body.title,
      issuer: req.body.issuer,
      year: req.body.year,
      certificateFile: req.file.filename,
    });

    seller.profileCompletion = calculateProfileCompletion(seller);
    await seller.save();

    res.json(seller);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Calculate profile completion percentage
const calculateProfileCompletion = (seller) => {
  let completion = 0;
  const fields = [
    "profileImage",
    "tagline",
    "location",
    "about",
    "specializations",
    "education",
    "certifications",
    "skills",
    "portfolio",
  ];

  fields.forEach((field) => {
    if (
      seller[field] &&
      ((Array.isArray(seller[field]) && seller[field].length > 0) ||
        (typeof seller[field] === "string" && seller[field].trim() !== ""))
    ) {
      completion += 100 / fields.length;
    }
  });

  return Math.round(completion);
};

// backend/controllers/sellerProfileController.js

// Get all seller profiles (for buyer dashboard)
// Get all seller profiles (for buyer dashboard)
export const getAllSellerProfiles = async (req, res) => {
  try {
    console.log("📡 Fetching all seller profiles with full data");
    
    const sellers = await Seller.find({})
      .populate("userId", "username email firstName lastName profileImage _id")
      .limit(20);

    console.log(`✅ Found ${sellers.length} sellers`);

    // Transform data to match frontend structure
    const transformedSellers = sellers.map(seller => {
      // CRITICAL: Include userId for messaging system
      const sellerData = {
        id: seller._id,
        _id: seller._id, // Add _id for consistency
        userId: seller.userId?._id, // CRITICAL: Include user ID for messaging
        title: seller.tagline || "ERP Specialist",
        provider: seller.userId?.username || seller.username || "Seller",
        email: seller.userId?.email || "N/A",
        rating: seller.rating || 4.5,
        reviews: seller.reviewCount || 0,
        price: seller.startingPrice || 100,
        delivery: seller.deliveryTime || "2 days",
        
        // FIXED: Check both seller profileImage and user profileImage
        img: seller.profileImage 
          ? `${process.env.REACT_APP_API_URL}/uploads/${seller.profileImage}`
          : seller.userId?.profileImage
            ? `${process.env.REACT_APP_API_URL}/uploads/${seller.userId.profileImage}`
            : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        
        description: seller.about || "Professional ERP services provider",
        level: seller.level || "Level 2 ERP Specialist",
        location: seller.location || "Not specified",
        memberSince: seller.memberSince,
        avgResponseTime: seller.avgResponseTime,
        lastDelivery: seller.lastDelivery,
        
        // Include all the detailed data
        professionalSummary: seller.professionalSummary,
        functionalRoles: seller.functionalRoles || [],
        technicalRoles: seller.technicalRoles || [],
        projects: seller.projects || [],
        technicalSkills: seller.technicalSkills || [],
        certifications: seller.certifications || [],
        servicesOffered: seller.servicesOffered || [],
        languages: seller.languages || [],
        specializations: seller.specializations || [],
        education: seller.education || [],
        
        // Include user data for reference
        user: seller.userId ? {
          _id: seller.userId._id,
          username: seller.userId.username,
          email: seller.userId.email,
          firstName: seller.userId.firstName,
          lastName: seller.userId.lastName,
          profileImage: seller.userId.profileImage
        } : null
      };

      console.log(`🔍 Seller ${sellerData.provider}:`, {
        sellerId: sellerData._id,
        userId: sellerData.userId,
        hasUser: !!sellerData.user
      });

      return sellerData;
    });

    console.log("📤 Sending transformed sellers data with user IDs");
    res.json(transformedSellers);
  } catch (error) {
    console.error("❌ Error fetching all seller profiles:", error);
    res.status(500).json({ message: error.message });
  }
};
