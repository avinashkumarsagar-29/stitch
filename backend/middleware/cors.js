const cors = require("cors");

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim());

const corsMiddleware = cors({
  origin: allowedOrigins,
});

module.exports = {
  corsMiddleware,
  allowedOrigins,
};
