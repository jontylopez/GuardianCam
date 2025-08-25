const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const os = require("os");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const fallDetectionRoutes = require("./routes/fallDetection");
const alertRoutes = require("./routes/alerts");
const pushRoutes = require("./routes/push");
const livekitRoutes = require("./routes/livekit");
const allowAnyOrigin = process.env.ALLOW_ANY_ORIGIN === 'true';
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

// Import middleware
const { errorHandler } = require("./middleware/errorHandler");
const { authenticateToken } = require("./middleware/auth");

// Import Firebase configuration
const { initializeFirebase } = require("./config/firebase");

const app = express();
const server = createServer(app);
// Trust reverse proxies (e.g., CRA dev server) so rate limiter and logs use correct client IP
app.set('trust proxy', 1);
const io = new Server(server, {
  cors: {
    origin: allowAnyOrigin ? true : allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Initialize Firebase
initializeFirebase();

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Do not rate-limit Socket.IO polling/WebSocket upgrade endpoints
  skip: (req) => req?.path?.startsWith('/socket.io'),
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
app.use(limiter);
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
// Increase JSON/body limits to handle batches of base64 frames
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Static files
app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "GuardianCam Backend is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/fall-detection", authenticateToken, fallDetectionRoutes);
app.use("/api/alerts", authenticateToken, alertRoutes);
// Push proxy (no auth; keep simple for local testing)
app.use("/api/push", pushRoutes);
// LiveKit token (no auth for demo)
app.use("/api/livekit", livekitRoutes);

// Socket.IO connection handling
// Track simple WebRTC rooms
const webrtcRooms = new Map(); // room -> { broadcaster: socketId | null, viewers: Set<socketId> }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join user to their room for personalized alerts
  socket.on("join-room", (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room`);
  });

  // --- WebRTC Signaling (simple room-based relay) ---
  socket.on("webrtc-join", ({ room, role }) => {
    if (!room) return;
    socket.join(room);
    let rec = webrtcRooms.get(room);
    if (!rec) {
      rec = { broadcaster: null, viewers: new Set() };
      webrtcRooms.set(room, rec);
    }
    if (role === "broadcaster") {
      rec.broadcaster = socket.id;
      console.log(`Broadcaster ${socket.id} joined room ${room}`);
    } else {
      rec.viewers.add(socket.id);
      console.log(`Viewer ${socket.id} joined room ${room}`);
    }
  });

  socket.on("viewer-ready", ({ room }) => {
    if (!room) return;
    // Forward the viewer's socket id so broadcaster can target offers
    socket.to(room).emit("viewer-ready", { from: socket.id });
  });

  socket.on("webrtc-offer", ({ room, sdp, toSocketId }) => {
    if (!room || !sdp) return;
    const rec = webrtcRooms.get(room);
    if (toSocketId) {
      io.to(toSocketId).emit("webrtc-offer", { sdp, from: socket.id });
      return;
    }
    // Fallback: broadcast to viewers only
    if (rec) {
      for (const vid of rec.viewers) {
        io.to(vid).emit("webrtc-offer", { sdp, from: socket.id });
      }
    } else {
      socket.to(room).emit("webrtc-offer", { sdp, from: socket.id });
    }
  });

  socket.on("webrtc-answer", ({ room, sdp, toSocketId }) => {
    if (!room || !sdp) return;
    const rec = webrtcRooms.get(room);
    if (toSocketId) {
      io.to(toSocketId).emit("webrtc-answer", { sdp, from: socket.id });
      return;
    }
    // Route answers only to the broadcaster
    if (rec?.broadcaster) {
      io.to(rec.broadcaster).emit("webrtc-answer", { sdp, from: socket.id });
    }
  });

  socket.on("webrtc-ice-candidate", ({ room, candidate }) => {
    if (!room || !candidate) return;
    socket.to(room).emit("webrtc-ice-candidate", { candidate });
  });

  // Handle fall detection alerts
  socket.on("fall-detected", (data) => {
    console.log("Fall detected:", data);
    // Broadcast to all connected clients
    io.emit("fall-alert", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Cleanup from rooms
    for (const [room, rec] of webrtcRooms.entries()) {
      if (rec.broadcaster === socket.id) rec.broadcaster = null;
      if (rec.viewers.has(socket.id)) rec.viewers.delete(socket.id);
    }
  });
});

app.use(cors({
  origin: allowAnyOrigin ? true : allowedOrigins,
  credentials: true,
}));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 5000;

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (!net || net.internal) continue;
      if (net.family === "IPv4") {
        if (/^docker|^vboxnet|^utun|^lo/.test(name)) continue;
        return net.address;
      }
    }
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`🚀 GuardianCam Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  const lanIp = process.env.LAN_IP || getLanIPv4() || "localhost";
  console.log(`🔗 Health check (local): http://localhost:${PORT}/health`);
  console.log(`🔗 Health check (LAN):   http://${lanIp}:${PORT}/health`);
});

module.exports = { app, io };
