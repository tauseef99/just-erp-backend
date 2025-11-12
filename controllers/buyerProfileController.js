import BuyerProfile from "../models/BuyerProfile.js";

// Get buyer profile
export const getBuyerProfile = async (req, res) => {
  try {
    const profile = await BuyerProfile.findOne({ user: req.user.id }).populate("user", "username email roles");
    
    if (!profile) {
      return res.status(404).json({ 
        message: "Buyer profile not found",
        profile: null
      });
    }
    
    res.json({
      message: "Buyer profile fetched successfully",
      profile
    });
  } catch (error) {
    console.error("Error fetching buyer profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create or update buyer profile
export const updateBuyerProfile = async (req, res) => {
  try {
    const { name, bio, company, position, location } = req.body;
    
    const profileData = {
      user: req.user.id,
      name,
      bio,
      company,
      position,
      location
    };
    
    // Find and update or create new profile
    const profile = await BuyerProfile.findOneAndUpdate(
      { user: req.user.id },
      profileData,
      { 
        new: true, 
        upsert: true, 
        runValidators: true 
      }
    ).populate("user", "username email roles");
    
    res.json({
      message: "Buyer profile updated successfully",
      profile
    });
  } catch (error) {
    console.error("Error updating buyer profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload profile image
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const profileImage = `/uploads/${req.file.filename}`;
    
    const profile = await BuyerProfile.findOneAndUpdate(
      { user: req.user.id },
      { profileImage },
      { new: true, upsert: true }
    ).populate("user", "username email roles");
    
    res.json({
      message: "Profile image uploaded successfully",
      profileImage: profile.profileImage,
      profile
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    res.status(500).json({ message: "Server error" });
  }
};