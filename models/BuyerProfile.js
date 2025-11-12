//backend/models/BuyerProfile.js
import mongoose from "mongoose";

const buyerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    profileImage: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      default: ""
    },
    company: {
      type: String,
      default: ""
    },
    position: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      default: ""
    },
    profileCompleteness: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Calculate profile completeness before saving
buyerProfileSchema.pre('save', function(next) {
  let completeness = 0;
  const fields = ['name', 'bio', 'company', 'position', 'location', 'profileImage'];
  const completedFields = fields.filter(field => {
    if (field === 'profileImage') return this[field] !== null;
    return this[field] && this[field].toString().trim().length > 0;
  });
  
  completeness = Math.round((completedFields.length / fields.length) * 100);
  this.profileCompleteness = completeness;
  
  next();
});

export default mongoose.model("BuyerProfile", buyerProfileSchema);