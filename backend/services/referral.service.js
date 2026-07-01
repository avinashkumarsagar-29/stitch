const Booking = require("../models/Booking");
const User = require("../models/User");
const Referral = require("../models/Referral");

async function confirmBookingAndProcessReferrals(bookingId) {
  const mongoBooking = await Booking.findById(bookingId);
  if (!mongoBooking) return null;

  const oldStatus = mongoBooking.status;
  if (oldStatus === "booked") {
    return mongoBooking;
  }

  mongoBooking.status = "booked";
  await mongoBooking.save();

  if (oldStatus === "pending-payment") {
    const userId = mongoBooking.userId;
    const creditApplied = Number(mongoBooking.creditApplied || 0);

    if (mongoBooking.tailorEmail) {
      const { sendPaymentSuccessEmailToTailor } = require("../utils/email");
      sendPaymentSuccessEmailToTailor(mongoBooking.tailorEmail, mongoBooking).catch((err) => {
        console.error("Failed to send payment success email to tailor:", err);
      });
    }

    if (creditApplied > 0) {
      const userDoc = await User.findById(userId);
      if (userDoc) {
        userDoc.credit = Math.max(0, (userDoc.credit || 0) - creditApplied);
        await userDoc.save();
      }
    }

    const referral = await Referral.findOne({ referredUserId: userId });
    if (referral && !referral.rewardGranted) {
      const confirmedCount = await Booking.countDocuments({
        userId,
        _id: { $ne: bookingId },
        status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
      });

      if (confirmedCount === 0) {
        referral.rewardGranted = true;
        await referral.save();

        const referrerDoc = await User.findById(referral.referrerUserId);
        if (referrerDoc) {
          referrerDoc.credit = (referrerDoc.credit || 0) + 50.00;
          await referrerDoc.save();
        }
      }
    }
  }

  return mongoBooking;
}

async function generateUniqueReferralCode() {
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
    code = `STITCH-${randomChars}`;
    const count = await User.countDocuments({ referralCode: code });
    if (count === 0) {
      isUnique = true;
    }
  }
  return code;
}

module.exports = {
  confirmBookingAndProcessReferrals,
  generateUniqueReferralCode,
};
