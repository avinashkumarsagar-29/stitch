const { authenticateApiRequest } = require("../middleware/auth");
const { getAppSettings } = require("../services/settings.service");

module.exports = (app, io) => {
  // Public auth routes (do not require API auth middleware)
  app.use("/api/auth", require("./auth.routes")(io));

  // Global authenticate middleware for protected API endpoints
  app.use("/api", authenticateApiRequest);

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

  // Tailors routes (which contains /api/tailors, /api/tailors/:tailorId, and /api/join)
  app.use("/", require("./tailors.routes")(io));
};
