const { authenticateApiRequest } = require("../middleware/auth");
const { getAppSettings } = require("../services/settings.service");

module.exports = (app, io) => {
  // Public auth routes (do not require API auth middleware)
  app.use("/api/auth", require("./auth.routes")(io));

  // Global authenticate middleware for protected API endpoints
  app.use("/api", (req, res, next) => {
    // Public routes — no auth needed
    const publicRoutes = [
      { method: "POST", path: "/api/auth/request-otp" },
      { method: "POST", path: "/api/auth/verify-otp" },
      { method: "POST", path: "/api/auth/register" },
      { method: "POST", path: "/api/auth/login" },
      { method: "GET",  path: "/api/auth/google" },
      { method: "GET",  path: "/api/auth/google/callback" },
      { method: "POST", path: "/api/auth/google-register" },
      { method: "GET",  path: "/api/tailors" },
    ];

    const reqPath = req.baseUrl + req.path;
    const isPublic = publicRoutes.some(
      (r) => r.method === req.method && reqPath === r.path
    ) || (req.method === "GET" && reqPath.startsWith("/api/tailors/"));

    if (isPublic) return next();
    return authenticateApiRequest(req, res, next);
  });

  // Global maintenance mode check for protected API endpoints
  app.use("/api", async (request, response, next) => {
    if (request.user?.role === "admin") {
      return next();
    }

    try {
      const appSettings = await getAppSettings();
      if (appSettings.maintenanceMode) {
        return response.status(503).json({
          message: "Stitch is temporarily in maintenance mode",
        });
      }
      return next();
    } catch (error) {
      console.error("Maintenance mode check error:", error);
      return response.status(500).json({
        message: "Unable to verify application availability",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.originalError?.message || error.message,
      });
    }
  });

  // Protected routes
  app.use("/api/admin", require("./admin.routes")(io));
  app.use("/api/users", require("./users.routes")(io));
  app.use("/api/bookings", require("./bookings.routes")(io));
  app.use("/api/payments", require("./payments.routes")(io));
  app.use("/api/reviews", require("./reviews.routes")(io));
  app.use("/api/business-orders", require("./business-orders.routes")(io));
  app.use("/api/discounts", require("./discounts.routes")(io));

  // Tailors routes (which contains /api/tailors, /api/tailors/:tailorId, and /api/join)
  app.use("/", require("./tailors.routes")(io));
};
