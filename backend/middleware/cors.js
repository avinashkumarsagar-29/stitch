const cors = require("cors");

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim());

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // In development mode, allow any origin (e.g., localhost, local network IPs, etc.)
    if (!origin || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
});

module.exports = {
  corsMiddleware,
  allowedOrigins,
};
