require("dotenv").config();

const express = require("express");
const { connectMongo } = require("./db.mongo");
const { corsMiddleware, allowedOrigins } = require("./middleware/cors");

// Initialize MongoDB Connection
connectMongo();

const app = express();
const port = Number(process.env.PORT || 4000);

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

