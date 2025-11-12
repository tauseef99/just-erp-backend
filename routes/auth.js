// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { generateCode } from "../utils/code.js";
import { sendVerificationEmail } from "../utils/mailer.js";

const router = express.Router();

// Rate limiter for resend endpoint
const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { message: "Too many resend attempts. Try again later." }
});

// ----------------- Register -----------------
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, roles = ["buyer"] } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);
    const code = generateCode();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const user = await User.create({
      username,
      email,
      password: hashed,
      roles: Array.isArray(roles) && roles.length ? roles : ["buyer"],
      verificationCode: code,
      verificationCodeExpiry: expiry,
      isVerified: false,
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error("Mail error:", mailErr);
      return res.status(201).json({
        message: "Registered but failed to send verification email. Contact admin.",
        email: user.email
      });
    }

    return res.status(201).json({ message: "Registered. Verification code sent to email.", email: user.email });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ----------------- Verify Email -----------------
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isVerified) return res.json({ message: "Already verified" });

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (Date.now() > new Date(user.verificationCodeExpiry).getTime()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ----------------- Resend Code -----------------
router.post("/resend-code", resendLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "User already verified" });

    const code = generateCode();
    user.verificationCode = code;
    user.verificationCodeExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error("Resend mail error:", mailErr);
      return res.status(500).json({ message: "Failed to send email" });
    }

    return res.json({ message: "Verification code resent" });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ----------------- Login -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    const payload = {
      id: user._id,
      role: user.roles && user.roles[0] ? user.roles[0] : "buyer",
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userSafe = {
      id: user._id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };

    return res.json({ message: "Login successful", token, user: userSafe });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
