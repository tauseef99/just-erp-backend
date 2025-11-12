// controllers/profileWizardController.js
import Seller from "../models/Seller.js";
import User from "../models/User.js"; 

// Get profile wizard data
export const getProfileWizardData = async (req, res) => {
  try {
    let seller = await Seller.findOne({ userId: req.user.id });

    if (!seller) {
      // Create a new seller profile with default values
      seller = new Seller({
        userId: req.user.id,
        username: req.user.username || "New Seller",
        professionalSummary: "",
        functionalRoles: [],
        technicalRoles: [],
        projects: [],
        technicalSkills: [],
        certifications: [],
        servicesOffered: [],
        languages: [],
        completedSteps: []
      });
      await seller.save();
    }

    res.json({
      professionalSummary: seller.professionalSummary || "",
      functionalRoles: seller.functionalRoles || [],
      technicalRoles: seller.technicalRoles || [],
      projects: seller.projects || [],
      technicalSkills: seller.technicalSkills || [],
      certifications: seller.certifications || [],
      servicesOffered: seller.servicesOffered || [],
      languages: seller.languages || [],
      completedSteps: seller.completedSteps || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update profile wizard step
export const updateProfileWizardStep = async (req, res) => {
  try {
    console.log('Update request received:', req.body);
    const { step, data, isCompleted } = req.body;

    let seller = await Seller.findOne({ userId: req.user.id });

    if (!seller) {
      seller = new Seller({
        userId: req.user.id,
        username: req.user.username || "New Seller", // Add username
        // ... other default fields
      });
    }

    // Update the specific step data
    switch (step) {
      case 0:
        seller.professionalSummary = data.professionalSummary || "";
        break;
      case 1:
        seller.functionalRoles = data.functionalRoles || [];
        break;
      case 2:
        seller.technicalRoles = data.technicalRoles || [];
        break;
      case 3:
        seller.projects = data.projects || [];
        break;
      case 4:
        seller.technicalSkills = data.technicalSkills || [];
        break;
      case 5:
        seller.certifications = data.certifications || [];
        break;
      case 6:
        seller.servicesOffered = data.servicesOffered || [];
        break;
      case 7:
        seller.languages = data.languages || [];
        break;
      default:
        return res.status(400).json({ message: "Invalid step number" });
    }

    // Update completed steps
    if (isCompleted && !seller.completedSteps.includes(step)) {
      seller.completedSteps.push(step);
    }

    seller.profileCompletion = calculateProfileCompletion(seller);

    // Add validation before save
    const validationError = seller.validateSync();
    if (validationError) {
      console.log('Validation errors:', validationError.errors);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationError.errors 
      });
    }

    await seller.save();
    res.json({
      message: "Step updated successfully",
      completedSteps: seller.completedSteps,
      profileCompletion: seller.profileCompletion
    });
  } catch (error) {
    console.error('Update error details:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: messages 
      });
    }
    
    res.status(500).json({ 
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Calculate profile completion percentage
const calculateProfileCompletion = (seller) => {
  let completion = 0;
  const fields = [
    "professionalSummary",
    "functionalRoles",
    "technicalRoles",
    "projects",
    "technicalSkills",
    "certifications",
    "servicesOffered",
    "languages",
    "profileImage",
    "tagline",
    "location",
    "about",
    "specializations",
    "education",
    "portfolio"
  ];

  fields.forEach((field) => {
    if (
      seller[field] &&
      ((Array.isArray(seller[field]) && seller[field].length > 0) ||
        (typeof seller[field] === "string" && seller[field].trim() !== "") ||
        (typeof seller[field] === "object" &&
          Object.keys(seller[field]).length > 0))
    ) {
      completion += 100 / fields.length;
    }
  });

  return Math.round(completion);
};

// Generate standardized tagline - FIXED CONTROLLER FUNCTION
export const generateTagline = async (req, res) => {
  try {
    console.log('Generate tagline request received');
    const seller = await Seller.findOne({ userId: req.user.id });

    if (!seller) {
      return res.status(404).json({ message: "Seller profile not found" });
    }

    // Use the helper function to calculate the tagline
    const tagline = calculateTagline(seller);
    
    // Update the seller's tagline
    seller.tagline = tagline;
    await seller.save();

    res.json({ 
      message: "Tagline generated successfully",
      tagline: tagline
    });
  } catch (error) {
    console.error('Tagline generation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function for tagline calculation
const calculateTagline = (seller) => {
  const certification =
    seller.certifications && seller.certifications.length > 0
      ? seller.certifications[0].name
      : "Certified";

  const experienceYears = calculateExperienceYears(seller.functionalRoles);

  const projectCount = seller.projects ? seller.projects.length : 0;

  const industries = [
    ...(seller.functionalRoles || []).map((role) => role.industry),
    ...(seller.technicalRoles || []).map((role) => role.industry),
    ...(seller.projects || []).map((project) => project.industry)
  ]
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

  const industryList =
    industries.length > 0
      ? `in ${industries.length} industries for example ${industries
          .slice(0, 3)
          .join(", ")}${
          industries.length > 3 ? ", and more" : ""
        }`
      : "";

  return `${certification} Consultant, with ${experienceYears}-years' experience, ${projectCount} projects delivered, ${industryList}`;
};

// Calculate experience years from roles
const calculateExperienceYears = (functionalRoles) => {
  if (!functionalRoles || functionalRoles.length === 0) return 0;
  return functionalRoles.length; // simplistic calculation
};