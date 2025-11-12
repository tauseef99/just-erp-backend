// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    
    // Handle case where token might have quotes
    const token = header.startsWith("Bearer ") ? 
                  header.slice(7).replace(/^"(.*)"$/, '$1') : null;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No token provided" 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User not found" 
      });
    }
    
    // Attach complete user object to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      profileImage: user.profileImage,
      // Include any other fields you need
    };
    
    next();
  } catch (error) {
    console.error('🔐 JWT verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token expired" 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token" 
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: "Authentication failed" 
    });
  }
};

export const allow = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: "Authentication required" 
    });
  }
  
  const userRole = req.user.role;
  const hasAccess = allowedRoles.includes(userRole);
  
  if (!hasAccess) {
    return res.status(403).json({ 
      success: false,
      message: "Access denied. Insufficient permissions." 
    });
  }
  
  next();
};