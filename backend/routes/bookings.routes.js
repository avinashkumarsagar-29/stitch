const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Measurement = require("../models/Measurement");
const Review = require("../models/Review");
const Referral = require("../models/Referral");
const JoinApplication = require("../models/JoinApplication");
const { requireAuth, getAuthenticatedUserId, isAuthenticatedTailor } = require("../middleware/auth");
const { uploadCloth, uploadClothImage } = require("../cloudinary");
const { confirmBookingAndProcessReferrals } = require("../services/referral.service");
const { sendBookingEmail, sendPriceQuoteEmail } = require("../utils/email");

module.exports = (io) => {
  const router = express.Router();

  router.post("/", requireAuth, async (request, response) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const pickupLocation = String(request.body.pickupLocation || "").trim();
      const dropoffLocation = String(request.body.dropoffLocation || "").trim();
      const bookingDate = String(request.body.bookingDate || "").trim();
      const bookingTime = String(request.body.bookingTime || "").trim();

      if (!userId) {
        return response.status(401).json({
          message: "Authentication required",
        });
      }

      if (!pickupLocation || !dropoffLocation || !bookingDate || !bookingTime) {
        return response.status(400).json({
          message: "Pickup, drop-off, date and time are required",
        });
      }

      const mongoBooking = new Booking({
        userId,
        pickupLocation,
        dropoffLocation,
        bookingDate,
        bookingTime,
        tailorApplicationId: null,
        tailorName: null,
        tailorEmail: null,
        tailorPhoneNumber: null,
        clothCategory: null,
        clothImage: null,
        material: null,
        approxPrice: null,
        status: "pending",
        trackingCode: null
      });
      await mongoBooking.save();
      io.emit("data:updated", { type: "bookings" });

      return response.status(201).json({
        message: "Booking saved successfully",
        booking: mongoBooking,
      });
    } catch (error) {
      console.error("Booking create error:", error);
      return response.status(500).json({
        message: "Unable to save booking",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.get("/", requireAuth, async (request, response) => {
    try {
      const authenticatedUserId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";

      let bookings;
      if (userRole === "tailor") {
        const tailorEmail = request.user?.email || "";
        const tailorPhoneNumber = request.user?.phoneNumber || "";

        bookings = await Booking.aggregate([
          {
            $match: {
              $or: [
                { tailorApplicationId: authenticatedUserId },
                { tailorEmail: { $ne: null, $regex: new RegExp("^" + tailorEmail.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "$", "i") } },
                { tailorPhoneNumber: { $ne: null, $regex: new RegExp("^" + tailorPhoneNumber.trim() + "$", "i") } },
                {
                  tailorApplicationId: null,
                  tailorEmail: null,
                  status: "pending-price"
                }
              ]
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "measurements",
              localField: "userId",
              foreignField: "userId",
              as: "measurement"
            }
          },
          { $unwind: { path: "$measurement", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              id: "$_id",
              userId: 1,
              fullName: "$user.fullName",
              email: "$user.email",
              pickupLocation: 1,
              dropoffLocation: 1,
              bookingDate: 1,
              bookingTime: 1,
              tailorApplicationId: 1,
              tailorName: 1,
              tailorEmail: 1,
              tailorPhoneNumber: 1,
              clothCategory: 1,
              clothImage: 1,
              material: 1,
              approxPrice: 1,
              originalTotal: 1,
              discountAmount: 1,
              finalTotal: 1,
              status: 1,
              trackingCode: 1,
              createdAt: 1,
              chest: "$measurement.chest",
              waist: "$measurement.waist",
              hip: "$measurement.hip",
              shoulder: "$measurement.shoulder",
              inseam: "$measurement.inseam"
            }
          },
          { $sort: { createdAt: -1 } }
        ]);
      } else if (userRole === "user") {
        bookings = await Booking.aggregate([
          { $match: { userId: authenticatedUserId } },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "measurements",
              localField: "userId",
              foreignField: "userId",
              as: "measurement"
            }
          },
          { $unwind: { path: "$measurement", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              id: "$_id",
              userId: 1,
              fullName: "$user.fullName",
              email: "$user.email",
              pickupLocation: 1,
              dropoffLocation: 1,
              bookingDate: 1,
              bookingTime: 1,
              tailorApplicationId: 1,
              tailorName: 1,
              tailorEmail: 1,
              tailorPhoneNumber: 1,
              clothCategory: 1,
              clothImage: 1,
              material: 1,
              approxPrice: 1,
              originalTotal: 1,
              discountAmount: 1,
              finalTotal: 1,
              status: 1,
              trackingCode: 1,
              createdAt: 1,
              chest: "$measurement.chest",
              waist: "$measurement.waist",
              hip: "$measurement.hip",
              shoulder: "$measurement.shoulder",
              inseam: "$measurement.inseam"
            }
          },
          { $sort: { createdAt: -1 } }
        ]);
      } else {
        return response.status(403).json({
          message: "Unauthorized role",
        });
      }

      return response.json({
        bookings,
      });
    } catch (error) {
      console.error("Booking list error:", error);
      return response.status(500).json({
        message: "Unable to load bookings",
        detail: error.message,
      });
    }
  });

  router.get("/:bookingId", requireAuth, async (request, response) => {
    try {
      const bookingIdParam = String(request.params.bookingId || "").trim();
      const bookingIdNum = Number(bookingIdParam) || 0;

      if (!bookingIdParam) {
        return response.status(400).json({
          message: "booking id or tracking code is required",
        });
      }

      const authenticatedUserId = getAuthenticatedUserId(request);

      // 1. Query Booking
      const mongoBooking = await Booking.findOne({
        $or: [
          { _id: bookingIdNum },
          { trackingCode: bookingIdParam }
        ]
      });

      if (!mongoBooking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      if (!isAuthenticatedTailor(request) && Number(mongoBooking.userId) !== authenticatedUserId) {
        return response.status(403).json({
          message: "You can only access your own bookings",
        });
      }

      // 2. Fetch related details
      const userDoc = await User.findById(mongoBooking.userId);
      const measurementDoc = await Measurement.findOne({ userId: mongoBooking.userId });
      const reviewDoc = await Review.findOne({ bookingId: mongoBooking._id });

      const bookingObj = {
        id: mongoBooking._id,
        userId: mongoBooking.userId,
        fullName: userDoc ? userDoc.fullName : null,
        email: userDoc ? userDoc.email : null,
        pickupLocation: mongoBooking.pickupLocation,
        dropoffLocation: mongoBooking.dropoffLocation,
        bookingDate: mongoBooking.bookingDate,
        bookingTime: mongoBooking.bookingTime,
        tailorApplicationId: mongoBooking.tailorApplicationId,
        tailorName: mongoBooking.tailorName,
        tailorEmail: mongoBooking.tailorEmail,
        tailorPhoneNumber: mongoBooking.tailorPhoneNumber,
        clothCategory: mongoBooking.clothCategory,
        clothImage: mongoBooking.clothImage,
        material: mongoBooking.material,
        approxPrice: mongoBooking.approxPrice,
        referralDiscount: mongoBooking.referralDiscount || 0.00,
        creditApplied: mongoBooking.creditApplied || 0.00,
        originalTotal: mongoBooking.originalTotal || null,
        discountAmount: mongoBooking.discountAmount || 0.00,
        finalTotal: mongoBooking.finalTotal || null,
        status: mongoBooking.status,
        trackingCode: mongoBooking.trackingCode,
        createdAt: mongoBooking.createdAt,
        chest: measurementDoc ? measurementDoc.chest : null,
        waist: measurementDoc ? measurementDoc.waist : null,
        hip: measurementDoc ? measurementDoc.hip : null,
        shoulder: measurementDoc ? measurementDoc.shoulder : null,
        inseam: measurementDoc ? measurementDoc.inseam : null,
        reviewId: reviewDoc ? reviewDoc._id : null,
        reviewRating: reviewDoc ? reviewDoc.rating : null,
        reviewComment: reviewDoc ? reviewDoc.comment : null,
      };

      // Dynamically calculate and save discounts if pending payment
      if (bookingObj.status === "pending-payment" && Number(bookingObj.userId) === authenticatedUserId) {
        try {
          const userId = Number(bookingObj.userId);
          const bookingId = Number(bookingObj.id);
          const basePrice = Number(bookingObj.approxPrice || 0);
          const gstFee = Math.round(basePrice * 0.18);
          const platformFee = 49;
          const totalBasePrice = basePrice + gstFee + platformFee;

          let referralDiscountApplied = 0;
          let creditApplied = 0;

          const referralDoc = await Referral.findOne({ referredUserId: userId });

          if (referralDoc) {
            const confirmedCount = await Booking.countDocuments({
              userId,
              _id: { $ne: bookingId },
              status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
            });
            if (confirmedCount === 0) {
              referralDiscountApplied = 50.00;
            }
          }

          const availableCredit = userDoc ? Number(userDoc.credit || 0) : 0;

          let tempPrice = totalBasePrice - referralDiscountApplied;
          if (tempPrice < 0) tempPrice = 0;

          creditApplied = Math.min(availableCredit, tempPrice);

          await Booking.findByIdAndUpdate(bookingId, {
            referralDiscount: referralDiscountApplied,
            creditApplied: creditApplied
          });

          bookingObj.referralDiscount = referralDiscountApplied;
          bookingObj.creditApplied = creditApplied;
        } catch (err) {
          console.error("Error calculating dynamic discounts on GET:", err);
        }
      }

      return response.json({ booking: bookingObj });
    } catch (error) {
      console.error("Booking detail error:", error);
      return response.status(500).json({
        message: "Unable to load booking",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.post("/:bookingId/details", requireAuth, uploadCloth.single("clothImage"), async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      const tailorApplicationId = Number(request.body.tailorApplicationId);
      const clothCategory = String(request.body.clothCategory || "").trim();
      const material = String(request.body.material || "").trim();
      const approxPrice = request.body.approxPrice !== undefined && request.body.approxPrice !== null ? Number(request.body.approxPrice) : null;
      const clothImage = request.file
        ? await uploadClothImage(request.file.buffer)
        : (request.body.clothImage || null);

      if (!bookingId || !tailorApplicationId) {
        return response.status(400).json({
          message: "Booking id and tailor id are required",
        });
      }

      if (!clothCategory || !material) {
        return response.status(400).json({
          message: "Cloth category and material are required",
        });
      }

      if (approxPrice !== null && (!Number.isFinite(approxPrice) || approxPrice <= 0)) {
        return response.status(400).json({
          message: "Approximate price must be a positive number",
        });
      }

      const mongoBooking = await Booking.findById(bookingId);
      if (!mongoBooking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      const ownerUser = await User.findById(mongoBooking.userId);
      const authenticatedUserId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";

      if (userRole === "user") {
        if (Number(mongoBooking.userId) !== authenticatedUserId) {
          return response.status(403).json({
            message: "You can only update details for your own bookings",
          });
        }
      } else if (userRole === "tailor") {
        const tailorEmail = request.user?.email || "";
        const tailorPhoneNumber = request.user?.phoneNumber || "";
        const isAssigned = (
          (mongoBooking.tailorApplicationId && Number(mongoBooking.tailorApplicationId) === authenticatedUserId) ||
          (mongoBooking.tailorEmail && mongoBooking.tailorEmail.toLowerCase().trim() === tailorEmail.toLowerCase().trim()) ||
          (mongoBooking.tailorPhoneNumber && mongoBooking.tailorPhoneNumber.trim() === tailorPhoneNumber.trim()) ||
          (!mongoBooking.tailorApplicationId && !mongoBooking.tailorEmail)
        );

        if (!isAssigned) {
          return response.status(403).json({
            message: "You are not authorized to update details for this booking",
          });
        }
      } else {
        return response.status(403).json({
          message: "Unauthorized role",
        });
      }

      const trackingCode = mongoBooking.trackingCode || String(Math.floor(1000000 + Math.random() * 9000000));
      const userEmail = ownerUser ? ownerUser.email : "";

      // Fetch tailor details
      let tailor = await JoinApplication.findById(tailorApplicationId);

      if (!tailor) {
        const userTailor = await User.findOne({ _id: tailorApplicationId, role: "tailor" });
        if (userTailor) {
          tailor = {
            id: userTailor._id,
            firstName: userTailor.firstName || userTailor.fullName.split(' ')[0] || '',
            lastName: userTailor.lastName || userTailor.fullName.split(' ').slice(1).join(' ') || '',
            email: userTailor.email,
            phoneNumber: userTailor.phoneNumber
          };
        }
      }

      if (!tailor) {
        return response.status(404).json({
          message: "Tailor not found",
        });
      }

      const tailorName = `${tailor.firstName} ${tailor.lastName}`.trim();
      const status = approxPrice !== null ? 'pending' : 'pending-price';

      mongoBooking.clothCategory = clothCategory;
      mongoBooking.clothImage = clothImage;
      mongoBooking.material = material;
      mongoBooking.approxPrice = approxPrice;
      mongoBooking.trackingCode = trackingCode;
      mongoBooking.tailorApplicationId = tailor.id;
      mongoBooking.tailorName = tailorName;
      mongoBooking.tailorEmail = tailor.email;
      mongoBooking.tailorPhoneNumber = tailor.phoneNumber;
      mongoBooking.status = status;
      await mongoBooking.save();

      // Send email confirmation in background if price is quoted/confirmed
      if (userEmail && approxPrice !== null) {
        sendBookingEmail(userEmail, mongoBooking).catch((err) => {
          console.error("Failed to send booking email:", err);
        });
      } else {
        console.log(`Booking #${bookingId} has no registered user email associated or price not set. Email notification skipped.`);
      }

      return response.json({
        message: "Order details saved successfully",
        booking: mongoBooking,
      });
    } catch (error) {
      console.error("Booking details error:", error);
      return response.status(500).json({
        message: "Unable to save order details",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.post("/:bookingId/tailor", requireAuth, async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      const tailorApplicationId = Number(request.body.tailorApplicationId);

      if (!bookingId || !tailorApplicationId) {
        return response.status(400).json({
          message: "Booking id and tailor id are required",
        });
      }

      if (!isAuthenticatedTailor(request)) {
        return response.status(403).json({
          message: "Only tailor accounts can accept bookings",
        });
      }

      const authenticatedUserId = getAuthenticatedUserId(request);
      const tailorEmail = request.user?.email || "";
      const tailorPhoneNumber = request.user?.phoneNumber || "";

      let isMatch = (tailorApplicationId === authenticatedUserId);

      if (!isMatch) {
        const checkMatchResult = await JoinApplication.findOne({
          _id: tailorApplicationId,
          $or: [
            { email: tailorEmail ? tailorEmail.toLowerCase().trim() : undefined },
            { phoneNumber: tailorPhoneNumber ? tailorPhoneNumber.trim() : undefined }
          ].filter(Boolean)
        });
        if (checkMatchResult) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        return response.status(403).json({
          message: "You can only accept bookings for your own tailor account",
        });
      }

      let tailor = await JoinApplication.findById(tailorApplicationId);
      if (!tailor) {
        const userTailor = await User.findOne({ _id: tailorApplicationId, role: "tailor" });
        if (userTailor) {
          tailor = {
            id: userTailor._id,
            firstName: userTailor.firstName || userTailor.fullName.split(' ')[0] || '',
            lastName: userTailor.lastName || userTailor.fullName.split(' ').slice(1).join(' ') || '',
            email: userTailor.email,
            phoneNumber: userTailor.phoneNumber
          };
        }
      }

      if (!tailor) {
        return response.status(404).json({
          message: "Tailor not found",
        });
      }

      const tailorName = `${tailor.firstName} ${tailor.lastName}`.trim();

      const mongoBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          tailorApplicationId: tailor.id,
          tailorName,
          tailorEmail: tailor.email,
          tailorPhoneNumber: tailor.phoneNumber,
          status: "booked",
        },
        { returnDocument: 'after' }
      );

      if (!mongoBooking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      return response.json({
        message: "Tailor booked successfully",
        booking: mongoBooking,
      });
    } catch (error) {
      console.error("Tailor booking error:", error);
      return response.status(500).json({
        message: "Unable to book tailor",
        detail: error.message,
      });
    }
  });

  router.patch("/:bookingId/status", requireAuth, async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      const { status } = request.body;

      if (!bookingId || !status) {
        return response.status(400).json({
          message: "Booking ID and status are required",
        });
      }

      const allowedStatuses = [
        'pending',
        'pending-price',
        'pending-payment',
        'booked',
        'picked-up',
        'in-stitching',
        'ready',
        'out-for-delivery',
        'delivered',
        'cancelled'
      ];

      if (!allowedStatuses.includes(status)) {
        return response.status(400).json({
          message: "Invalid status value",
        });
      }

      const mongoBooking = await Booking.findById(bookingId);
      if (!mongoBooking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      const authenticatedUserId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";

      if (userRole === "tailor") {
        if (!mongoBooking.tailorApplicationId || Number(mongoBooking.tailorApplicationId) !== authenticatedUserId) {
          return response.status(403).json({
            message: "You are not authorized to update this booking status",
          });
        }
        const forbiddenTailorStatuses = ["pending", "pending-price", "pending-payment"];
        if (forbiddenTailorStatuses.includes(status)) {
          return response.status(400).json({
            message: "Tailors cannot set status to pending, pending-price, or pending-payment",
          });
        }
      } else if (userRole === "user") {
        if (Number(mongoBooking.userId) !== authenticatedUserId) {
          return response.status(403).json({
            message: "You can only update your own booking status",
          });
        }
        if (status === "booked") {
          if (mongoBooking.status !== "pending-payment") {
            return response.status(400).json({
              message: "Cannot mark booking as booked unless it is pending payment",
            });
          }
        } else if (status === "cancelled") {
          const cancellableStatuses = ["pending", "pending-price", "pending-payment"];
          if (!cancellableStatuses.includes(mongoBooking.status)) {
            return response.status(400).json({
              message: "Cannot cancel a booking that is already confirmed or in progress",
            });
          }
        } else {
          return response.status(403).json({
            message: "You are not authorized to set this status",
          });
        }
      } else {
        return response.status(403).json({
          message: "Unauthorized role",
        });
      }

      let finalBooking = mongoBooking;
      if (status === "booked") {
        const updated = await confirmBookingAndProcessReferrals(bookingId);
        if (!updated) {
          return response.status(404).json({
            message: "Booking not found",
          });
        }
        finalBooking = updated;
      } else {
        mongoBooking.status = status;
        await mongoBooking.save();
      }

      // Targeted emit to booking room (for TrackingMap live update)
      io.to(`booking-${bookingId}`).emit("booking:status-changed", {
        bookingId,
        status: finalBooking.status || status,
      });

      // Broadcast to all clients (for UserOrderStatus + BookingHistory auto-refresh)
      io.emit("data:updated", { type: "bookings" });

      return response.json({
        message: "Booking status updated successfully",
        booking: finalBooking.toObject(),
      });
    } catch (error) {
      console.error("Booking status update error:", error);
      return response.status(500).json({
        message: "Unable to update booking status",
        detail: error.message,
      });
    }
  });

  router.patch("/:bookingId/price", requireAuth, async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      const { approxPrice, tailorApplicationId } = request.body;

      if (!isAuthenticatedTailor(request)) {
        return response.status(403).json({
          message: "Only tailor accounts can submit price quotes",
        });
      }

      if (!bookingId || approxPrice === undefined || approxPrice === null) {
        return response.status(400).json({
          message: "Booking ID and approxPrice are required",
        });
      }

      const priceNum = Number(approxPrice);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return response.status(400).json({
          message: "approxPrice must be a positive number",
        });
      }

      let tailor = null;
      if (tailorApplicationId) {
        const tailorId = Number(tailorApplicationId);
        tailor = await JoinApplication.findById(tailorId);

        if (!tailor) {
          const userTailor = await User.findOne({ _id: tailorId, role: "tailor" });
          if (userTailor) {
            tailor = {
              id: userTailor._id,
              firstName: userTailor.firstName || userTailor.fullName.split(' ')[0] || '',
              lastName: userTailor.lastName || userTailor.fullName.split(' ').slice(1).join(' ') || '',
              email: userTailor.email,
              phoneNumber: userTailor.phoneNumber
            };
          }
        }

        if (!tailor) {
          return response.status(404).json({
            message: "Tailor not found",
          });
        }
      }

      let booking;

      if (tailor) {
        const tailorName = `${tailor.firstName} ${tailor.lastName}`.trim();

        booking = await Booking.findByIdAndUpdate(bookingId, {
          approxPrice: priceNum,
          status: "pending-payment",
          tailorApplicationId: Number(tailor.id || tailor._id),
          tailorName,
          tailorEmail: tailor.email,
          tailorPhoneNumber: tailor.phoneNumber,
        }, { new: true });
      } else {
        booking = await Booking.findByIdAndUpdate(bookingId, {
          approxPrice: priceNum,
          status: "pending-payment",
        }, { new: true });
      }

      if (!booking) {
        return response.status(404).json({
          message: "Booking not found",
        });
      }

      if (booking) {
        const ownerUser = await User.findById(booking.userId);
        if (ownerUser && ownerUser.email) {
          const bookingDetails = {
            ...booking.toObject(),
            id: booking._id,
            userEmail: ownerUser.email,
            userFullName: ownerUser.fullName
          };
          sendPriceQuoteEmail(ownerUser.email, bookingDetails).catch((err) => {
            console.error("Failed to send price quote email:", err);
          });
        }
      }

      return response.json({
        message: "Booking price updated successfully",
        booking: booking.toObject(),
      });
    } catch (error) {
      console.error("Booking price update error:", error);
      return response.status(500).json({
        message: "Unable to update booking price",
        detail: error.message,
      });
    }
  });

  return router;
};
