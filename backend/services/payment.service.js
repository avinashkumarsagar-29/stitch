const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const User = require("../models/User");
const JoinApplication = require("../models/JoinApplication");
const { confirmBookingAndProcessReferrals } = require("./referral.service");
const { getAuthenticatedUserId, canAccessUser } = require("../middleware/auth");

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const isRazorpayConfigured = !!(keyId && keyId.trim() && keySecret && keySecret.trim());

let razorpayInstance = null;
if (isRazorpayConfigured) {
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

async function logPayment(userId, amount, planPurchased, razorpayOrderId, razorpayPaymentId, status) {
  try {
    if (razorpayOrderId) {
      const existing = await Payment.findOne({ razorpayOrderId });
      if (existing) {
        existing.razorpayPaymentId = razorpayPaymentId || null;
        existing.status = status;
        await existing.save();
        return;
      }
    }

    const payment = new Payment({
      userId,
      amount,
      planPurchased,
      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId: razorpayPaymentId || null,
      status,
    });
    await payment.save();
  } catch (error) {
    console.error("logPayment error:", error);
  }
}

async function verifyPaymentHandler(request, response) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      userId,
      isMock,
    } = request.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return response.status(400).json({
        message: "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    // 1. Fetch related payment information
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    const finalPlanId = planId || payment?.planPurchased;
    const finalUserId = userId || payment?.userId || getAuthenticatedUserId(request);

    if (!finalUserId) {
      return response.status(400).json({
        message: "User ID is required",
      });
    }

    if (!canAccessUser(request, finalUserId)) {
      return response.status(403).json({
        message: "You can only verify payments for your own account",
      });
    }

    if (isMock || String(razorpay_order_id).startsWith("order_mock_") || String(razorpay_order_id).startsWith("order_free_")) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      // Allow mock if no keys are configured, or if it is a free order
      if (keyId && keyId.trim() && !String(razorpay_order_id).startsWith("order_free_")) {
        return response.status(400).json({
          message: "Mock payments are disabled because real Razorpay keys are configured",
        });
      }

      // Mark the payment as verified in Payment model
      if (payment) {
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.status = "verified";
        await payment.save();
      } else {
        let amountVal = 0;
        if (finalPlanId === "Pro") amountVal = 799.00;
        else if (finalPlanId === "Plus") amountVal = 299.00;
        else if (finalPlanId === "Alterations") amountVal = 0.00;
        else if (finalPlanId === "Custom") amountVal = 199.00;
        else if (finalPlanId === "Bespoke") amountVal = 299.00;

        if (finalPlanId && finalPlanId.startsWith("booking_")) {
          const bookingId = Number(finalPlanId.replace("booking_", ""));
          const b = await Booking.findById(bookingId);
          if (b) {
            amountVal = Number(b.approxPrice || 0);
          }
        }
        await logPayment(finalUserId, amountVal, finalPlanId || "unknown", razorpay_order_id, razorpay_payment_id, "verified");
      }

      // Mark booking as paid if booking plan
      if (finalPlanId && finalPlanId.startsWith("booking_")) {
        const bookingId = Number(finalPlanId.replace("booking_", ""));
        const updatedBooking = await confirmBookingAndProcessReferrals(bookingId);
        if (!updatedBooking) {
          return response.status(404).json({ message: "Booking not found" });
        }
      } else if (finalPlanId) {
        // subscription updates
        await User.findByIdAndUpdate(finalUserId, { plan: finalPlanId });
        const user = await User.findById(finalUserId);
        if (user && user.role === "tailor") {
          await JoinApplication.updateMany(
            { $or: [{ email: user.email }, { phoneNumber: user.phoneNumber }] },
            { plan: finalPlanId }
          );
        }
      }

      return response.json({
        success: true,
        message: finalPlanId && finalPlanId.startsWith("booking_") ? "Mock payment verified and booking confirmed" : "Mock payment verified and subscription activated",
        plan: finalPlanId,
      });
    }

    // 2. Real signature verification
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return response.status(500).json({
        message: "Razorpay keys are not configured on the server",
      });
    }

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    const signatureBuffer = Buffer.from(razorpay_signature);
    const generatedBuffer = Buffer.from(generated_signature);

    if (signatureBuffer.length !== generatedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, generatedBuffer)) {
      if (payment) {
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.status = "failed";
        await payment.save();
      }
      return response.status(400).json({
        message: "Invalid payment signature. Payment verification failed.",
      });
    }

    // Update payment in db
    if (payment) {
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.status = "verified";
      await payment.save();
    } else {
      let amountVal = 0;
      if (finalPlanId === "Pro") amountVal = 799.00;
      else if (finalPlanId === "Plus") amountVal = 299.00;
      else if (finalPlanId === "Alterations") amountVal = 0.00;
      else if (finalPlanId === "Custom") amountVal = 199.00;
      else if (finalPlanId === "Bespoke") amountVal = 299.00;

      if (finalPlanId && finalPlanId.startsWith("booking_")) {
        const bookingId = Number(finalPlanId.replace("booking_", ""));
        const b = await Booking.findById(bookingId);
        if (b) {
          amountVal = Number(b.approxPrice || 0);
        }
      }
      await logPayment(finalUserId, amountVal, finalPlanId || "unknown", razorpay_order_id, razorpay_payment_id, "verified");
    }

    // Mark booking as paid if booking plan
    if (finalPlanId && finalPlanId.startsWith("booking_")) {
      const bookingId = Number(finalPlanId.replace("booking_", ""));
      const updatedBooking = await confirmBookingAndProcessReferrals(bookingId);
      if (!updatedBooking) {
        return response.status(404).json({ message: "Booking not found to mark as paid" });
      }
    } else if (finalPlanId) {
      // subscription updates
      await User.findByIdAndUpdate(finalUserId, { plan: finalPlanId });
      const user = await User.findById(finalUserId);
      if (user && user.role === "tailor") {
        await JoinApplication.updateMany(
          { $or: [{ email: user.email }, { phoneNumber: user.phoneNumber }] },
          { plan: finalPlanId }
        );
      }
    }

    return response.json({
      success: true,
      message: finalPlanId && finalPlanId.startsWith("booking_") ? "Payment verified and booking confirmed successfully" : "Payment verified and subscription activated successfully",
      plan: finalPlanId,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    try {
      const finalUserId = request.body.userId || getAuthenticatedUserId(request) || 0;
      await logPayment(finalUserId, 0, request.body.planId || "unknown", request.body.razorpay_order_id || "unknown", request.body.razorpay_payment_id || "unknown", "failed");
    } catch (e) {
      console.error("Failed to log failed payment error:", e);
    }
    return response.status(500).json({
      message: "Unable to verify payment signature",
      detail: error.message,
    });
  }
}

module.exports = {
  logPayment,
  verifyPaymentHandler,
  isRazorpayConfigured,
  razorpayInstance,
};
