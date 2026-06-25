const express = require("express");
const { checkFirstOrderDiscount } = require("../utils/discount");
const { requireAuth } = require("../middleware/auth");

module.exports = (io) => {
  const router = express.Router();

  router.post("/check", requireAuth, async (request, response) => {
    try {
      const userId = Number(request.body.userId);
      if (!userId) {
        return response.status(400).json({
          message: "User ID is required",
        });
      }

      const check = await checkFirstOrderDiscount(userId);

      if (check.eligible) {
        return response.json({
          eligible: true,
          percent: check.percent,
          minOrder: check.minOrder,
          message: "🎉 20% off on your first order!",
        });
      }

      return response.json({
        eligible: false,
        message: "First order discount already used",
      });
    } catch (error) {
      console.error("Error in /api/discounts/check:", error);
      return response.status(500).json({
        message: "Unable to check discount status",
        detail: error.message,
      });
    }
  });

  return router;
};
