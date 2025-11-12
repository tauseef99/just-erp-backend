//backend/models/Seller.js

import mongoose from "mongoose";

const functionalRoleSchema = new mongoose.Schema({
  year: String,
  role: String,
  responsibility: String,
  teamSize: String,
  industry: String,
});

const technicalRoleSchema = new mongoose.Schema({
  year: String,
  role: String,
  responsibility: String,
  teamSize: String,
  industry: String,
});

const projectSchema = new mongoose.Schema({
  name: String,
  industry: String,
  role: String,
  teamSize: String,
  activities: String,
});

const certificationSchema = new mongoose.Schema({
  name: String,
  exam: String,
  number: String,
  issuedBy: String,
  validity: String,
});




const languageSchema = new mongoose.Schema({
  language: String,
  proficiency: {
    type: String,
    enum: ["Basic", "Intermediate", "Fluent", "Native"], // Remove empty string
    default: "Basic", // Set a proper default
  },
});

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  year: { type: String, required: true },
});

const specializationSchema = new mongoose.Schema({
  category: { type: String, required: true },
  items: [{ type: String }],
});

const portfolioItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  status: { type: String, default: "Completed" },
  imageUrl: { type: String },
});

const sellerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    username: { type: String, required: false },
    profileImage: { type: String },
    level: { type: String, default: "Level 2 ERP Specialist" },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 128 },
    tagline: {
      type: String,
      default:
        "Certified ERP Implementation Specialist | SAP & Oracle Expert",
    },
    location: { type: String, default: "Karachi, Pakistan" },
    memberSince: { type: Date, default: Date.now },
    avgResponseTime: { type: String, default: "< 1 hour" },
    lastDelivery: { type: String, default: "2 days ago" },
    about: { type: String },

    // Profile Wizard Fields
    professionalSummary: { type: String, maxlength: 150 },
    functionalRoles: [functionalRoleSchema],
    technicalRoles: [technicalRoleSchema],
    projects: [projectSchema],
    technicalSkills: [{ type: String }],
    certifications: [certificationSchema],
    servicesOffered: [{ type: String }],
    languages: [languageSchema],
    completedSteps: { type: [Number], default: [] },

    // Original fields
    specializations: [specializationSchema],
    education: [educationSchema],
    portfolio: [portfolioItemSchema],
    profileCompletion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Seller = mongoose.model("Seller", sellerSchema);

export default Seller;
