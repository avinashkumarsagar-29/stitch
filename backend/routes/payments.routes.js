const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Referral = require("../models/Referral");
const JoinApplication = require("../models/JoinApplication");
const { requireAuth, canAccessUser } = require("../middleware/auth");
const { logPayment, verifyPaymentHandler, isRazorpayConfigured, razorpayInstance } = require("../services/payment.service");

module.exports = (io) => {
  const router = express.Router();

  router.post("/create-order", requireAuth, async (request, response) => {
    try {
      const planId = String(request.body.planId || "").trim();
      const price = Number(request.body.price);
      const userId = Number(request.body.userId);
      const billingCycle = String(request.body.billingCycle || "monthly").trim();

      if (!planId || !userId) {
        return response.status(400).json({
          message: "Plan ID and User ID are required",
        });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({
          message: "You can only create payment orders for your own account",
        });
      }

      let finalPrice = price;
      let referralDiscountApplied = 0;
      let creditApplied = 0;

      if (planId.startsWith("booking_")) {
        const bookingId = Number(planId.replace("booking_", ""));
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          return response.status(404).json({
            message: "Booking not found",
          });
        }

        const basePrice = Number(booking.approxPrice || 0);
        const gstFee = Math.round(basePrice * 0.18);
        const platformFee = 49;
        const totalBasePrice = basePrice + gstFee + platformFee;

        // Check if user is referred and has not had a booking confirmed yet
        const referral = await Referral.findOne({ referredUserId: userId });

        if (referral) {
          const bookedCount = await Booking.countDocuments({
            userId,
            status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] },
            _id: { $ne: bookingId }
          });
          if (bookedCount === 0) {
            referralDiscountApplied = 50.00;
          }
        }

        // Check user available credit balance
        const user = await User.findById(userId);
        const availableCredit = Number(user?.credit || 0);

        let tempPrice = totalBasePrice - referralDiscountApplied;
        if (tempPrice < 0) tempPrice = 0;

        creditApplied = Math.min(availableCredit, tempPrice);
        finalPrice = tempPrice - creditApplied;
        if (finalPrice < 0) finalPrice = 0;

        // Save referralDiscount and creditApplied back to booking
        await Booking.findByIdAndUpdate(bookingId, {
          referralDiscount: referralDiscountApplied,
          creditApplied
        });
      }

      // Determine amount in paise
      let amount = request.body.amount;
      if (amount === undefined || amount === null) {
        amount = Math.round(finalPrice * 100);
      }

      // Free plan bypass
      if (amount === 0) {
        const freeOrderId = "order_free_" + Math.random().toString(36).substring(2, 11);
        await logPayment(userId, 0, planId, freeOrderId, null, 'pending');
        return response.json({
          id: freeOrderId,
          order_id: freeOrderId,
          amount: 0,
          currency: "INR",
          isMock: true,
          isFree: true,
          key: "rzp_test_mockkey",
          key_id: "rzp_test_mockkey",
          planId,
          billingCycle,
          referralDiscount: referralDiscountApplied,
          creditApplied,
        });
      }

      // Validate amount >= 100 paise before calling Razorpay; return 400 if not
      if (amount < 100) {
        return response.status(400).json({
          message: "Amount must be at least 100 paise (1 INR)",
        });
      }

      if (!isRazorpayConfigured) {
        // Return a Mock Order for developer testing
        const mockOrderId = "order_mock_" + Math.random().toString(36).substring(2, 11);
        await logPayment(userId, amount / 100, planId, mockOrderId, null, 'pending');
        return response.json({
          id: mockOrderId,
          order_id: mockOrderId,
          amount,
          currency: "INR",
          isMock: true,
          key: "rzp_test_mockkey",
          key_id: "rzp_test_mockkey",
          planId,
          billingCycle,
          referralDiscount: referralDiscountApplied,
          creditApplied,
        });
      }

      try {
        const orderData = await razorpayInstance.orders.create({
          amount: Math.round(amount),
          currency: "INR",
          receipt: "receipt_order_" + Date.now(),
        });

        await logPayment(userId, amount / 100, planId, orderData.id, null, 'pending');

        return response.json({
          id: orderData.id,
          order_id: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          isMock: false,
          key: process.env.RAZORPAY_KEY_ID,
          planId,
          billingCycle,
          referralDiscount: referralDiscountApplied,
          creditApplied,
        });
      } catch (sdkError) {
        console.error("Razorpay SDK Order Creation Error:", sdkError);
        if (sdkError.statusCode === 401 || (sdkError.error && sdkError.error.description && sdkError.error.description.includes("Authentication"))) {
          return response.status(401).json({
            message: "Razorpay authentication failed. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend .env file, or comment them out to run in Sandbox/Mock mode.",
            detail: sdkError,
          });
        }
        return response.status(500).json({
          message: sdkError.message || "Failed to create Razorpay order",
          detail: sdkError,
        });
      }
    } catch (error) {
      console.error("Create order error:", error);
      return response.status(500).json({
        message: "Unable to create payment order",
        detail: error.message,
      });
    }
  });

  router.post("/verify", requireAuth, verifyPaymentHandler);
  router.post("/verify-payment", requireAuth, verifyPaymentHandler);

  router.post("/activate-free-plan", requireAuth, async (request, response) => {
    try {
      const { planId, userId } = request.body;

      if (!userId) {
        return response.status(400).json({
          message: "User ID is required",
        });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({
          message: "You can only activate plans for your own account",
        });
      }

      const planToActivate = planId || "Free";

      // Update plan in Users
      await User.findByIdAndUpdate(userId, { plan: planToActivate });

      // Sync to JoinApplications if tailor
      const user = await User.findById(userId);

      if (user && user.role === "tailor") {
        await JoinApplication.updateMany(
          { $or: [{ email: user.email }, { phoneNumber: user.phoneNumber }] },
          { plan: planToActivate }
        );
      }

      await logPayment(userId, 0, planToActivate, "free_" + Date.now(), "free_activation", "verified");

      return response.json({
        success: true,
        message: "Free tier plan activated successfully",
        plan: planToActivate,
      });
    } catch (error) {
      console.error("Activate free plan error:", error);
      return response.status(500).json({
        message: "Unable to activate free plan",
        detail: error.message,
      });
    }
  });

  return router;
};
