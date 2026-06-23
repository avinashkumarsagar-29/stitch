const express = require("express");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const { requireAuth, getAuthenticatedUserId } = require("../middleware/auth");

module.exports = (io) => {
  const router = express.Router();

  router.post("/", requireAuth, async (request, response) => {
    try {
      const { bookingId, rating, comment } = request.body;
      const userId = getAuthenticatedUserId(request);

      if (!bookingId || !rating) {
        return response.status(400).json({
          message: "Booking ID and rating are required",
        });
      }

      const ratingNum = Number(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return response.status(400).json({
          message: "Rating must be a number between 1 and 5",
        });
      }

      const booking = await Booking.findById(Number(bookingId));

      if (!booking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      if (Number(booking.userId) !== userId) {
        return response.status(403).json({
          message: "You can only review your own bookings",
        });
      }

      if (booking.status !== "delivered") {
        return response.status(400).json({
          message: "You can only review bookings that have been delivered",
        });
      }

      if (!booking.tailorApplicationId) {
        return response.status(400).json({
          message: "No tailor partner is assigned to this booking",
        });
      }

      const existingReview = await Review.findOne({ bookingId: Number(bookingId) });
      if (existingReview) {
        return response.status(400).json({
          message: "You have already reviewed this booking",
        });
      }

      const review = await new Review({
        bookingId: Number(bookingId),
        userId,
        tailorApplicationId: Number(booking.tailorApplicationId),
        rating: ratingNum,
        comment: comment ? String(comment).slice(0, 500) : null,
      }).save();

      return response.status(201).json({
        message: "Review submitted successfully",
        reviewId: review.id,
      });
    } catch (error) {
      console.error("Create review error:", error);
      return response.status(500).json({
        message: "Unable to submit review",
        detail: error.message,
      });
    }
  });

  return router;
};
