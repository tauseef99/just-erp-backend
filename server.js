

//////////============================================updatd code

// backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import morgan from "morgan";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import sellerProfileRoutes from "./routes/sellerProfile.js";
import buyerProfileRoutes from "./routes/buyerProfile.js";
import profileWizardRoutes from "./routes/profileWizard.js";
import messageRoutes from "./routes/messages.js"; 
import callRoutes from "./routes/calls.js";
import { auth, allow } from "./middleware/auth.js";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import paymentRoutes from "./routes/payment.js";
import offerRoutes from "./routes/offers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ==================== CORS MIDDLEWARE (MUST BE FIRST) ====================
// app.use(cors({ 
//   origin: process.env.CLIENT_URL || "${process.env.REACT_APP_FRONTEND_URL}",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
// }));
app.use(cors({ 
  origin: [
    "https://new-erp-services-tets.vercel.app",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// ==================== STRIPE WEBHOOK (BEFORE JSON) ====================
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentRoutes
);

// ==================== NORMAL MIDDLEWARE ====================
app.use(express.json());
app.use(morgan("dev"));

// ==================== SOCKET.IO SETUP ====================
// const io = new SocketIOServer(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || "${process.env.REACT_APP_FRONTEND_URL}",
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials: true
//   },
//   transports: ["websocket", "polling"]
// });


const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "https://new-erp-services-tets.vercel.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});
// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.token;
  
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==================== ROUTES ====================
app.use("/api/auth", authRoutes);
app.use("/api/seller/profile", auth, sellerProfileRoutes);
app.use("/api/buyer/profile", auth, buyerProfileRoutes);
app.use("/api/profile-wizard", auth, profileWizardRoutes);
app.use("/api/messages", auth, messageRoutes);
app.use("/api/calls", auth, callRoutes); 
app.use("/api/offers", auth, offerRoutes);
app.use("/api/payments", paymentRoutes); // ✅ Moved after JSON middleware
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Demo endpoints
app.get("/api/buyer/dashboard", auth, allow(["buyer"]), (req, res) => {
  res.json({ message: "Buyer dashboard data" });
});

app.get("/api/seller/dashboard", auth, allow(["seller"]), (req, res) => {
  res.json({ message: "Seller dashboard data" });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// ====================== SOCKET.IO HANDLING ======================
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id, "User ID:", socket.userId);

  // --- Personal room ---
  if (socket.userId) {
    socket.join(socket.userId);
    console.log(`✅ User ${socket.userId} joined their personal room`);
  }

  // --- Join user room (for direct messaging) ---
  socket.on("joinUser", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`✅ Socket ${socket.id} joined user room: ${userId}`);
    }
  });

  // --- Offer system ---
  socket.on("newOffer", (offer) => {
    console.log("📦 New offer created:", offer._id);
    // Emit to buyer
    socket.to(offer.buyerId).emit("newOffer", offer);
    // Emit to conversation room
    socket.to(offer.conversationId).emit("offerUpdated", { offer });
  });

  socket.on("offerUpdated", (data) => {
    console.log("🔄 Offer updated:", data.offer._id);
    socket.to(data.offer.conversationId).emit("offerUpdated", data);
    socket.to(data.offer.buyerId).emit("offerUpdated", data);
    socket.to(data.offer.sellerId).emit("offerUpdated", data);
  });

  // --- Rest of your socket handlers remain the same ---
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`✅ User ${socket.userId} joined conversation: ${conversationId}`);
  });

  socket.on("leaveConversation", (conversationId) => {
    socket.leave(conversationId);
    console.log(`✅ User ${socket.userId} left conversation: ${conversationId}`);
  });

  // ... rest of your socket handlers
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.get("/", (req, res) => {
  res.send("Backend is live and running..");
}); 
// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  );
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});