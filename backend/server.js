require("dotenv").config();

const express = require("express");
const { connectMongo } = require("./db.mongo");
const { corsMiddleware, allowedOrigins } = require("./middleware/cors");
const webpush = require("web-push");
const { requireAuth, requireAdmin } = require("./middleware/auth");

// Initialize MongoDB Connection
connectMongo();

const app = express();
const port = Number(process.env.PORT || 4000);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@stitch.org.in",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory push subscriptions store (use MongoDB for production)
global.pushSubscriptions = new Map();

// Global Middlewares
app.use(corsMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Basic Routes (defined in server.js directly)
app.get("/", (_request, response) => {
  response.json({
    name: "Stitch backend",
    status: "running",
    endpoints: {
      health: "/health",
      register: "POST /api/auth/register",
      requestOtp: "POST /api/auth/request-otp",
      verifyOtp: "POST /api/auth/verify-otp",
      bookings: "POST /api/bookings",
      tailors: "GET /api/tailors?location=pickup",
    },
  });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/health/db", async (_request, response) => {
  try {
    const mongoose = require("mongoose");
    const state = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    if (state === 1) {
      return response.json({
        status: "ok",
        database: mongoose.connection.name || "mongodb",
        connectionState: states[state]
      });
    } else {
      return response.status(500).json({
        status: "error",
        connectionState: states[state] || "unknown"
      });
    }
  } catch (error) {
    console.error("Database health error:", error);
    response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Socket.io and HTTP Server Setup
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// Mount routes passing app and io instance
require("./routes/index")(app, io);

io.on("connection", (socket) => {
  console.log("Client connected to Socket.IO:", socket.id);

  socket.on("join-booking", (bookingId) => {
    socket.join(`booking-${bookingId}`);
    console.log(`Socket ${socket.id} joined room booking-${bookingId}`);
  });

  socket.on("update-location", (data) => {
    console.log(`Location update for booking ${data.bookingId}:`, data.lat, data.lng);
    io.to(`booking-${data.bookingId}`).emit("location-updated", {
      lat: data.lat,
      lng: data.lng,
      timestamp: Date.now()
    });
  });

  socket.on("tailor:online", ({ tailorId, bookingId }) => {
    socket.join(`booking-${bookingId}`);
    io.to(`booking-${bookingId}`).emit("tailor:status", { online: true, tailorId });
  });

  socket.on("tailor:offline", ({ tailorId, bookingId }) => {
    io.to(`booking-${bookingId}`).emit("tailor:status", { online: false, tailorId });
  });

  socket.on("ping:tailor", ({ bookingId }) => {
    socket.to(`booking-${bookingId}`).emit("pong:tailor", { alive: true, ts: Date.now() });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected from Socket.IO:", socket.id);
  });
});

// Generate VAPID keys (temporary route)
app.get("/api/admin/generate-vapid", (req, res) => {
  const keys = webpush.generateVAPIDKeys();
  res.json(keys);
});

// Save admin push subscription
app.post("/api/admin/push-subscribe", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    global.pushSubscriptions.set(String(userId), subscription);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to save subscription" });
  }
});

// Delete admin push subscription
app.post("/api/admin/push-unsubscribe", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    global.pushSubscriptions.delete(String(userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove subscription" });
  }
});

server.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});

// fix: remove fs.appendFileSync crash on Render
// Find this exact block (around line 509):
//   if (!isMailConfigured) {
//     const logFilePath = path.join(__dirname, "mock_emails.log");
//     const logEntry = `...`;
//     try {
//       fs.appendFileSync(logFilePath, logEntry, "utf8");
//       console.log(`Mock OTP email logged successfully to ${logFilePath}`);
//     } catch (err) {
//       console.error("Failed to write mock OTP email to log file:", err);
//     }
//     return { sent: false, mock: true };
//   }
// Replace with this:
//   if (!isMailConfigured) {
//     console.log(`[MOCK OTP] To: ${userEmail} | OTP: ${otpCode}`);
//     return { sent: false, mock: true, otp: otpCode };
//   }

