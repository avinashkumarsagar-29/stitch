const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const JoinApplication = require("../models/JoinApplication");
const AppSettings = require("../models/AppSettings");
const BusinessOrder = require("../models/BusinessOrder");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const Referral = require("../models/Referral");
const Measurement = require("../models/Measurement");
const { requireAdmin, getAuthenticatedUserId } = require("../middleware/auth");
const { normalizePhoneNumber } = require("../utils/validators");
const { getAppSettings } = require("../services/settings.service");

module.exports = (io) => {
  const router = express.Router();

  router.get("/summary", requireAdmin, async (_request, response) => {
    try {
      const [
        total,
        users,
        tailors,
        admins,
        totalBookings,
        pendingBookings,
        bookedBookings,
        deliveredBookings,
        cancelledBookings,
        totalApps,
        pendingApps,
        approvedApps,
        rejectedApps,
        recentUsers,
        recentBookingsRaw,
        recentApplications,
        revenueAggregation
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "tailor" }),
        User.countDocuments({ role: "admin" }),
        Booking.countDocuments(),
        Booking.countDocuments({ status: { $in: ['pending', 'pending-price', 'pending-payment'] } }),
        Booking.countDocuments({ status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery'] } }),
        Booking.countDocuments({ status: 'delivered' }),
        Booking.countDocuments({ status: 'cancelled' }),
        JoinApplication.countDocuments(),
        JoinApplication.countDocuments({ status: "pending" }),
        JoinApplication.countDocuments({ status: "approved" }),
        JoinApplication.countDocuments({ status: "rejected" }),
        User.find().sort({ createdAt: -1 }).limit(5),
        Booking.find().sort({ createdAt: -1 }).limit(5),
        JoinApplication.find().sort({ createdAt: -1 }).limit(5),
        Booking.aggregate([
          {
            $match: {
              status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
            }
          },
          {
            $project: {
              val: {
                $subtract: [
                  {
                    $add: [
                      { $ifNull: ["$approxPrice", 0] },
                      { $round: [{ $multiply: [{ $ifNull: ["$approxPrice", 0] }, 0.18] }, 0] },
                      49
                    ]
                  },
                  {
                    $add: [
                      { $ifNull: ["$referralDiscount", 0] },
                      { $ifNull: ["$creditApplied", 0] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalCollected: {
                $sum: {
                  $cond: {
                    if: { $lt: ["$val", 0] },
                    then: 0,
                    else: "$val"
                  }
                }
              }
            }
          }
        ])
      ]);

      const totalCollected = revenueAggregation[0]?.totalCollected || 0;

      const userIds = [...new Set(recentBookingsRaw.map(b => b.userId).filter(id => id !== null && id !== undefined))];
      const bookingUsers = await User.find({ _id: { $in: userIds } });
      const userMap = new Map(bookingUsers.map(u => [u._id, u]));

      const recentBookings = recentBookingsRaw.map(b => {
        const u = b.userId ? userMap.get(b.userId) : null;
        return {
          id: b._id,
          status: b.status,
          approxPrice: b.approxPrice,
          createdAt: b.createdAt,
          fullName: u ? u.fullName : null
        };
      });

      const recentActivity = [
        ...recentBookings.map((booking) => ({
          id: `booking-${booking.id}`,
          type: "booking",
          title: `Booking #${booking.id} ${booking.status || "created"}`,
          detail: booking.fullName ? `Customer: ${booking.fullName}` : "Customer booking activity",
          amount: booking.approxPrice !== undefined && booking.approxPrice !== null ? Number(booking.approxPrice) : null,
          createdAt: booking.createdAt,
        })),
        ...recentApplications.map((application) => ({
          id: `application-${application.id}`,
          type: "application",
          title: `${[application.firstName, application.lastName].filter(Boolean).join(" ") || "Tailor"} application`,
          detail: `Status: ${application.status || "pending"}`,
          amount: null,
          createdAt: application.createdAt,
        })),
        ...recentUsers.map((user) => ({
          id: `user-${user.id}`,
          type: "user",
          title: `${user.fullName || "New user"} joined`,
          detail: `Role: ${user.role || "user"}`,
          amount: null,
          createdAt: user.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

      return response.json({
        users: {
          total: Number(total || 0),
          users: Number(users || 0),
          tailors: Number(tailors || 0),
          admins: Number(admins || 0),
        },
        bookings: {
          total: Number(totalBookings || 0),
          pending: Number(pendingBookings || 0),
          booked: Number(bookedBookings || 0),
          delivered: Number(deliveredBookings || 0),
          cancelled: Number(cancelledBookings || 0),
        },
        revenue: {
          totalCollected: Number(totalCollected || 0),
          currency: "INR",
        },
        applications: {
          total: Number(totalApps || 0),
          pending: Number(pendingApps || 0),
          approved: Number(approvedApps || 0),
          rejected: Number(rejectedApps || 0),
        },
        recentActivity,
      });
    } catch (error) {
      console.error("Admin summary error:", error);
      return response.status(500).json({
        message: "Unable to load admin summary",
        detail: error.message,
      });
    }
  });

  router.get("/settings", requireAdmin, async (_request, response) => {
    try {
      const settings = await getAppSettings();
      const mongooseInstance = require("mongoose");
      const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });

      return response.json({
        settings,
        admins,
        backendHealth: {
          status: "ok",
          database: mongooseInstance.connection.name || "mongodb",
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Admin settings load error:", error);
      return response.status(500).json({
        message: "Unable to load admin settings",
        detail: error.message,
      });
    }
  });

  router.patch("/settings", requireAdmin, async (request, response) => {
    try {
      const allowedKeys = ["disableNewRegistrations", "maintenanceMode"];
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(request.body, key)) {
          const val = request.body[key] ? "true" : "false";
          await AppSettings.findOneAndUpdate(
            { key },
            { value: val },
            { upsert: true, returnDocument: 'after' }
          );
        }
      }

      const settings = await getAppSettings();
      return response.json({
        message: "Settings updated",
        settings,
      });
    } catch (error) {
      console.error("Admin settings update error:", error);
      return response.status(500).json({
        message: "Unable to update admin settings",
        detail: error.message,
      });
    }
  });

  router.post("/admins", requireAdmin, async (request, response) => {
    try {
      const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);
      if (!phoneNumber) {
        return response.status(400).json({
          message: "Phone number is required",
        });
      }

      if (request.user?.email !== process.env.SUPER_ADMIN_EMAIL) {
        return response.status(403).json({
          message: "Forbidden: Only super admin can add admins",
        });
      }

      const admin = await User.findOneAndUpdate(
        { phoneNumber },
        { role: 'admin' },
        { returnDocument: 'after' }
      );

      if (!admin) {
        return response.status(404).json({
          message: "No user found with that phone number",
        });
      }

      return response.json({
        message: "Admin account added",
        admin,
      });
    } catch (error) {
      console.error("Admin account create error:", error);
      return response.status(500).json({
        message: "Unable to create admin account",
        detail: error.message,
      });
    }
  });

  router.delete("/admins/:userId", requireAdmin, async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      if (!userId) {
        return response.status(400).json({
          message: "User ID is required",
        });
      }

      if (userId === getAuthenticatedUserId(request)) {
        return response.status(400).json({
          message: "You cannot remove your own admin access",
        });
      }

      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return response.status(400).json({
          message: "At least one admin account is required",
        });
      }

      if (request.user?.email !== process.env.SUPER_ADMIN_EMAIL) {
        return response.status(403).json({
          message: "Forbidden: Only super admin can remove admins",
        });
      }

      const user = await User.findOneAndUpdate(
        { _id: userId, role: 'admin' },
        { role: 'user' },
        { returnDocument: 'after' }
      );

      if (!user) {
        return response.status(404).json({
          message: "Admin account not found",
        });
      }

      return response.json({
        message: "Admin access removed",
        user,
      });
    } catch (error) {
      console.error("Admin account remove error:", error);
      return response.status(500).json({
        message: "Unable to remove admin access",
        detail: error.message,
      });
    }
  });

  router.get("/users", requireAdmin, async (request, response) => {
    try {
      const roleFilter = request.query.role || "";
      const planFilter = request.query.plan || "";
      const searchQuery = request.query.search || "";

      const filter = {};
      if (roleFilter) {
        filter.role = roleFilter;
      }
      if (planFilter) {
        filter.plan = planFilter;
      }
      if (searchQuery) {
        filter.$or = [
          { fullName: { $regex: searchQuery, $options: "i" } },
          { email: { $regex: searchQuery, $options: "i" } },
          { phoneNumber: { $regex: searchQuery, $options: "i" } }
        ];
      }

      const users = await User.find(filter).sort({ createdAt: -1 });
      return response.json({ users });
    } catch (error) {
      console.error("Admin users list error:", error);
      return response.status(500).json({
        message: "Unable to load users",
        detail: error.message
      });
    }
  });

  router.patch("/users/:userId/role", requireAdmin, async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      const newRole = String(request.body.role || "").trim().toLowerCase();

      if (!["user", "tailor", "admin"].includes(newRole)) {
        return response.status(400).json({ message: "Invalid role value. Must be 'user', 'tailor', or 'admin'" });
      }

      if (newRole === "admin" && request.user?.email !== process.env.SUPER_ADMIN_EMAIL) {
        return response.status(403).json({
          message: "Forbidden: Only super admin can assign admin role"
        });
      }

      await User.findByIdAndUpdate(userId, { role: newRole });

      return response.json({ message: `User role successfully updated to ${newRole}` });
    } catch (error) {
      console.error("Admin user role update error:", error);
      return response.status(500).json({
        message: "Unable to update user role",
        detail: error.message
      });
    }
  });

  router.patch("/users/:userId/ban", requireAdmin, async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      const isBanned = !!request.body.isBanned;

      await User.findByIdAndUpdate(userId, { isBanned });
      io.emit("data:updated", { type: "users" });

      return response.json({ message: isBanned ? "User account deactivated" : "User account activated" });
    } catch (error) {
      console.error("Admin user ban update error:", error);
      return response.status(500).json({
        message: "Unable to update user ban status",
        detail: error.message
      });
    }
  });

  router.get("/users/:userId/bookings", requireAdmin, async (request, response) => {
    try {
      const userId = Number(request.params.userId);

      const user = await User.findById(userId);

      if (!user) {
        return response.status(404).json({ message: "User not found" });
      }

      const userEmail = user.email ? user.email.toLowerCase().trim() : "";
      const userPhone = user.phoneNumber ? user.phoneNumber.trim() : "";
      const isTailor = user.role === "tailor";

      const bookingQuery = {
        $or: [
          { userId: userId }
        ]
      };

      if (isTailor) {
        if (userEmail) {
          bookingQuery.$or.push({ tailorEmail: userEmail });
        }
        if (userPhone) {
          bookingQuery.$or.push({ tailorPhoneNumber: userPhone });
        }
      }

      const bookingsResult = await Booking.find(bookingQuery).sort({ createdAt: -1 });

      const businessQuery = {
        $or: [
          { userId: userId }
        ]
      };

      if (isTailor) {
        if (userEmail) {
          businessQuery.$or.push({ tailorEmail: userEmail });
        }
        if (userPhone) {
          businessQuery.$or.push({ tailorPhoneNumber: userPhone });
        }
      }

      const businessResult = await BusinessOrder.find(businessQuery).sort({ createdAt: -1 });

      return response.json({
        bookings: bookingsResult,
        businessOrders: businessResult
      });
    } catch (error) {
      console.error("Admin user bookings load error:", error);
      return response.status(500).json({
        message: "Unable to load user bookings history",
        detail: error.message
      });
    }
  });

  router.patch("/join/:applicationId/approve", requireAdmin, async (request, response) => {
    try {
      const applicationId = Number(request.params.applicationId);
      if (!applicationId) {
        return response.status(400).json({ message: "Application ID is required" });
      }

      const appRecord = await JoinApplication.findById(applicationId);
      if (!appRecord) {
        return response.status(404).json({ message: "Application not found" });
      }

      if (appRecord.status === "approved") {
        return response.status(400).json({ message: "Application is already approved" });
      }

      appRecord.status = "approved";
      appRecord.rejectionReason = null;
      await appRecord.save();
      io.emit("data:updated", { type: "applications" });

      const email = appRecord.email ? appRecord.email.toLowerCase().trim() : "";
      const phoneNumber = appRecord.phoneNumber ? appRecord.phoneNumber.trim() : "";

      const userCheck = await User.findOne({
        $or: [
          { email: email ? email : undefined },
          { phoneNumber: phoneNumber ? phoneNumber : undefined }
        ].filter(Boolean)
      });

      let promoted = false;
      if (userCheck) {
        const fullName = `${appRecord.firstName} ${appRecord.lastName}`.trim();
        userCheck.role = 'tailor';
        userCheck.fullName = fullName;
        userCheck.firstName = appRecord.firstName;
        userCheck.lastName = appRecord.lastName;
        userCheck.address = appRecord.location;
        userCheck.image = appRecord.image;
        userCheck.plan = appRecord.plan || "Free";
        await userCheck.save();
        promoted = true;
      }

      return response.json({
        message: "Application approved successfully",
        promoted
      });
    } catch (error) {
      console.error("Approve tailor application error:", error);
      return response.status(500).json({
        message: "Unable to approve application",
        detail: error.message
      });
    }
  });

  router.patch("/join/:applicationId/reject", requireAdmin, async (request, response) => {
    try {
      const applicationId = Number(request.params.applicationId);
      const reason = String(request.body.reason || "").trim();

      if (!applicationId) {
        return response.status(400).json({ message: "Application ID is required" });
      }
      if (!reason) {
        return response.status(400).json({ message: "Rejection reason is required" });
      }

      const appRecord = await JoinApplication.findById(applicationId);
      if (!appRecord) {
        return response.status(404).json({ message: "Application not found" });
      }

      appRecord.status = "rejected";
      appRecord.rejectionReason = reason;
      await appRecord.save();
      io.emit("data:updated", { type: "applications" });

      return response.json({ message: "Application rejected successfully" });
    } catch (error) {
      console.error("Reject tailor application error:", error);
      return response.status(500).json({
        message: "Unable to reject application",
        detail: error.message
      });
    }
  });

  router.get("/bookings", requireAdmin, async (request, response) => {
    try {
      const status = String(request.query.status || "").trim();
      const search = String(request.query.search || "").trim();

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const bookingsRaw = await Booking.find(filter).sort({ createdAt: -1 });

      const userIds = [...new Set(bookingsRaw.map(b => b.userId).filter(id => id !== null && id !== undefined))];
      const users = await User.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [u._id, u]));

      const bookings = [];
      for (const b of bookingsRaw) {
        const u = b.userId ? userMap.get(b.userId) : null;
        const bookingObj = {
          ...b.toObject(),
          id: b._id,
          customerName: u ? u.fullName : null,
          customerEmail: u ? u.email : null,
          customerPhone: u ? u.phoneNumber : null
        };

        if (search) {
          const s = search.toLowerCase();
          const match = (bookingObj.customerName && bookingObj.customerName.toLowerCase().includes(s)) ||
            (bookingObj.tailorName && bookingObj.tailorName.toLowerCase().includes(s)) ||
            (bookingObj.trackingCode && bookingObj.trackingCode.toLowerCase().includes(s)) ||
            (bookingObj.clothCategory && bookingObj.clothCategory.toLowerCase().includes(s));
          if (match) {
            bookings.push(bookingObj);
          }
        } else {
          bookings.push(bookingObj);
        }
      }

      return response.json({ bookings });
    } catch (error) {
      console.error("Admin bookings fetch error:", error);
      return response.status(500).json({
        message: "Unable to load bookings",
        detail: error.message,
      });
    }
  });

  router.get("/bookings/:bookingId", requireAdmin, async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      if (!bookingId) {
        return response.status(400).json({ message: "Booking ID is required" });
      }

      const b = await Booking.findById(bookingId);
      if (!b) {
        return response.status(404).json({ message: "Booking not found" });
      }

      const u = b.userId ? await User.findById(b.userId) : null;
      const booking = {
        ...b.toObject(),
        id: b._id,
        customerName: u ? u.fullName : null,
        customerEmail: u ? u.email : null,
        customerPhone: u ? u.phoneNumber : null
      };

      let measurements = null;
      if (b.userId) {
        measurements = await Measurement.findOne({ userId: b.userId });
      }

      return response.json({ booking, measurements });
    } catch (error) {
      console.error("Admin booking detail error:", error);
      return response.status(500).json({
        message: "Unable to load booking details",
        detail: error.message,
      });
    }
  });

  router.patch("/bookings/:bookingId/status", requireAdmin, async (request, response) => {
    try {
      const bookingId = Number(request.params.bookingId);
      const { status, trackingCode, approxPrice } = request.body;

      if (!bookingId) {
        return response.status(400).json({ message: "Booking ID is required" });
      }
      if (!status) {
        return response.status(400).json({ message: "Status is required" });
      }

      const b = await Booking.findById(bookingId);
      if (!b) {
        return response.status(404).json({ message: "Booking not found" });
      }

      b.status = status;
      if (trackingCode !== undefined) {
        b.trackingCode = trackingCode || null;
      }
      if (approxPrice !== undefined) {
        b.approxPrice = approxPrice !== null && approxPrice !== "" ? Number(approxPrice) : null;
      }

      await b.save();
      io.emit("data:updated", { type: "bookings" });

      const newStatus = status;
      io.to(`booking-${bookingId}`).emit("booking:status-changed", {
        bookingId,
        status: newStatus
      });

      return response.json({ message: "Booking updated successfully" });
    } catch (error) {
      console.error("Admin override booking status error:", error);
      return response.status(500).json({
        message: "Unable to update booking status",
        detail: error.message,
      });
    }
  });

  router.get("/business-orders", requireAdmin, async (request, response) => {
    try {
      const status = String(request.query.status || "").trim();
      const search = String(request.query.search || "").trim();

      const filter = {};
      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { companyName: { $regex: search, $options: "i" } },
          { contactName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { tailorName: { $regex: search, $options: "i" } },
          { businessType: { $regex: search, $options: "i" } }
        ];
      }

      const ordersRaw = await BusinessOrder.find(filter).sort({ createdAt: -1 });

      const userIds = [...new Set(ordersRaw.map(bo => bo.userId).filter(id => id !== null && id !== undefined))];
      const users = await User.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [u._id, u]));

      const businessOrders = [];
      for (const bo of ordersRaw) {
        const u = bo.userId ? userMap.get(bo.userId) : null;
        businessOrders.push({
          ...bo.toObject(),
          id: bo._id,
          userFullName: u ? u.fullName : null
        });
      }

      return response.json({ businessOrders });
    } catch (error) {
      console.error("Admin business orders fetch error:", error);
      return response.status(500).json({
        message: "Unable to load business orders",
        detail: error.message,
      });
    }
  });

  router.patch("/business-orders/:orderId", requireAdmin, async (request, response) => {
    try {
      const orderId = Number(request.params.orderId);
      const { status, approxPrice, targetDeliveryDate, tailorId } = request.body;

      if (!orderId) {
        return response.status(400).json({ message: "Order ID is required" });
      }

      const order = await BusinessOrder.findById(orderId);
      if (!order) {
        return response.status(404).json({ message: "Business order not found" });
      }

      let tailorName = undefined;
      let tailorEmail = undefined;
      let tailorPhoneNumber = undefined;

      if (tailorId !== undefined) {
        if (tailorId === null || tailorId === "") {
          tailorName = null;
          tailorEmail = null;
          tailorPhoneNumber = null;
        } else {
          const tailorApp = await JoinApplication.findById(Number(tailorId));
          if (tailorApp) {
            tailorName = `${tailorApp.firstName} ${tailorApp.lastName}`.trim();
            tailorEmail = tailorApp.email;
            tailorPhoneNumber = tailorApp.phoneNumber;
          } else {
            const userTailor = await User.findOne({ _id: Number(tailorId), role: "tailor" });
            if (userTailor) {
              tailorName = userTailor.fullName;
              tailorEmail = userTailor.email;
              tailorPhoneNumber = userTailor.phoneNumber;
            } else {
              return response.status(400).json({ message: "Invalid tailor selection" });
            }
          }
        }
      }

      if (status !== undefined) {
        order.status = status;
        if (status === "delivered") {
          order.deliveredAt = new Date();
        }
      }

      if (approxPrice !== undefined) {
        order.approxPrice = approxPrice !== null && approxPrice !== "" ? Number(approxPrice) : null;
      }

      if (targetDeliveryDate !== undefined) {
        order.targetDeliveryDate = targetDeliveryDate ? new Date(targetDeliveryDate) : null;
      }

      if (tailorId !== undefined) {
        order.tailorApplicationId = tailorId ? Number(tailorId) : null;
        order.tailorName = tailorName;
        order.tailorEmail = tailorEmail;
        order.tailorPhoneNumber = tailorPhoneNumber;
      }

      await order.save();

      return response.json({ message: "Business order updated successfully" });
    } catch (error) {
      console.error("Admin business order update error:", error);
      return response.status(500).json({
        message: "Unable to update business order",
        detail: error.message,
      });
    }
  });

  router.get("/payments", requireAdmin, async (request, response) => {
    try {
      const status = String(request.query.status || "").trim();
      const search = String(request.query.search || "").trim();
      const startDate = String(request.query.startDate || "").trim();
      const endDate = String(request.query.endDate || "").trim();

      const filter = {};
      if (status) {
        filter.status = status;
      }
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          filter.createdAt.$lt = end;
        }
      }

      const paymentsRaw = await Payment.find(filter).sort({ createdAt: -1 });

      const userIds = [...new Set(paymentsRaw.map(p => p.userId).filter(id => id !== null && id !== undefined))];
      const users = await User.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [u._id, u]));

      const payments = [];
      for (const p of paymentsRaw) {
        const u = p.userId ? userMap.get(p.userId) : null;
        const paymentObj = {
          ...p.toObject(),
          id: p._id,
          customerName: u ? u.fullName : null,
          customerEmail: u ? u.email : null,
          customerPhone: u ? u.phoneNumber : null
        };

        if (search) {
          const s = search.toLowerCase();
          const match = (paymentObj.customerName && paymentObj.customerName.toLowerCase().includes(s)) ||
            (paymentObj.customerEmail && paymentObj.customerEmail.toLowerCase().includes(s)) ||
            (paymentObj.planPurchased && paymentObj.planPurchased.toLowerCase().includes(s)) ||
            (paymentObj.razorpayOrderId && paymentObj.razorpayOrderId.toLowerCase().includes(s)) ||
            (paymentObj.razorpayPaymentId && paymentObj.razorpayPaymentId.toLowerCase().includes(s));
          if (match) {
            payments.push(paymentObj);
          }
        } else {
          payments.push(paymentObj);
        }
      }

      const verifiedPayments = await Payment.find({ status: "verified" });
      let freeRevenue = 0;
      let plusRevenue = 0;
      let proRevenue = 0;
      let bookingsRevenue = 0;

      for (const p of verifiedPayments) {
        const plan = String(p.planPurchased).toLowerCase();
        const amt = Number(p.amount || 0);

        if (plan === "free") {
          freeRevenue += amt;
        } else if (plan === "plus") {
          plusRevenue += amt;
        } else if (plan === "pro") {
          proRevenue += amt;
        } else {
          bookingsRevenue += amt;
        }
      }

      return response.json({
        payments,
        breakdown: {
          free: freeRevenue,
          plus: plusRevenue,
          pro: proRevenue,
          bookings: bookingsRevenue,
          total: freeRevenue + plusRevenue + proRevenue + bookingsRevenue
        }
      });
    } catch (error) {
      console.error("Admin payments fetch error:", error);
      return response.status(500).json({
        message: "Unable to load payments dashboard",
        detail: error.message,
      });
    }
  });

  router.get("/reviews", requireAdmin, async (request, response) => {
    try {
      const search = String(request.query.search || "").trim();
      const rating = request.query.rating ? Number(request.query.rating) : null;

      const filter = {};
      if (rating) {
        filter.rating = rating;
      }

      const reviewsRaw = await Review.find(filter).sort({ createdAt: -1 });

      const userIds = [...new Set(reviewsRaw.map(r => r.userId).filter(id => id !== null && id !== undefined))];
      const tailorIds = [...new Set(reviewsRaw.map(r => r.tailorApplicationId).filter(id => id !== null && id !== undefined))];

      const [users, joinApps, userTailors, averagesAggregation] = await Promise.all([
        User.find({ _id: { $in: userIds } }),
        JoinApplication.find({ _id: { $in: tailorIds } }),
        User.find({ _id: { $in: tailorIds }, role: "tailor" }),
        Review.aggregate([
          {
            $group: {
              _id: "$tailorApplicationId",
              averageRating: { $avg: "$rating" },
              reviewCount: { $sum: 1 }
            }
          }
        ])
      ]);

      const userMap = new Map(users.map(u => [u._id, u]));
      const joinAppMap = new Map(joinApps.map(ja => [ja._id, ja]));
      const userTailorMap = new Map(userTailors.map(ut => [ut._id, ut]));

      const reviews = [];
      for (const r of reviewsRaw) {
        const u = r.userId ? userMap.get(r.userId) : null;
        const ja = r.tailorApplicationId ? joinAppMap.get(r.tailorApplicationId) : null;
        const ut = (!ja && r.tailorApplicationId) ? userTailorMap.get(r.tailorApplicationId) : null;

        const reviewObj = {
          ...r.toObject(),
          id: r._id,
          customerName: u ? u.fullName : null,
          customerEmail: u ? u.email : null,
          tailorName: ja ? `${ja.firstName} ${ja.lastName}`.trim() : (ut ? ut.fullName : null),
          tailorEmail: ja ? ja.email : (ut ? ut.email : null)
        };

        if (search) {
          const s = search.toLowerCase();
          const match = (reviewObj.customerName && reviewObj.customerName.toLowerCase().includes(s)) ||
            (reviewObj.tailorName && reviewObj.tailorName.toLowerCase().includes(s)) ||
            (reviewObj.comment && reviewObj.comment.toLowerCase().includes(s));
          if (match) {
            reviews.push(reviewObj);
          }
        } else {
          reviews.push(reviewObj);
        }
      }

      const tailors = await JoinApplication.find();
      const averagesMap = new Map(averagesAggregation.map(item => [item._id, item]));

      const averages = [];
      for (const ja of tailors) {
        // Find matching User ID to check if reviews were aggregated under User ID
        const userTailor = await User.findOne({
          $or: [
            { email: ja.email ? ja.email.toLowerCase().trim() : undefined },
            { phoneNumber: ja.phoneNumber ? ja.phoneNumber.trim() : undefined }
          ].filter(Boolean)
        });

        // Sum averages from both JoinApplication ID and User ID
        const avgInfoJa = averagesMap.get(ja._id);
        const avgInfoUt = userTailor ? averagesMap.get(userTailor._id) : null;

        let totalReviews = 0;
        let sumRating = 0;
        if (avgInfoJa) {
          totalReviews += avgInfoJa.reviewCount;
          sumRating += avgInfoJa.averageRating * avgInfoJa.reviewCount;
        }
        if (avgInfoUt) {
          totalReviews += avgInfoUt.reviewCount;
          sumRating += avgInfoUt.averageRating * avgInfoUt.reviewCount;
        }

        if (totalReviews > 0) {
          averages.push({
            tailorId: ja._id,
            tailorName: `${ja.firstName} ${ja.lastName}`.trim(),
            tailorEmail: ja.email,
            averageRating: Number((sumRating / totalReviews).toFixed(2)),
            reviewCount: totalReviews
          });
        }
      }
      averages.sort((a, b) => b.averageRating - a.averageRating);

      return response.json({
        reviews,
        averages
      });
    } catch (error) {
      console.error("Admin reviews fetch error:", error);
      return response.status(500).json({
        message: "Unable to load reviews dashboard",
        detail: error.message,
      });
    }
  });

  router.delete("/reviews/:reviewId", requireAdmin, async (request, response) => {
    try {
      const reviewId = Number(request.params.reviewId);
      if (!reviewId) {
        return response.status(400).json({ message: "Review ID is required" });
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        return response.status(404).json({ message: "Review not found" });
      }

      await Review.findByIdAndDelete(reviewId);

      return response.json({ message: "Review deleted successfully" });
    } catch (error) {
      console.error("Admin review delete error:", error);
      return response.status(500).json({
        message: "Unable to delete review",
        detail: error.message,
      });
    }
  });

  router.get("/referrals", requireAdmin, async (request, response) => {
    try {
      const [referralsRaw, users] = await Promise.all([
        Referral.find().sort({ createdAt: -1 }),
        User.find().sort({ credit: -1, fullName: 1 })
      ]);

      const userMap = new Map(users.map(u => [u._id, u]));

      const referrals = [];
      for (const r of referralsRaw) {
        const u1 = r.referrerUserId ? userMap.get(r.referrerUserId) : null;
        const u2 = r.referredUserId ? userMap.get(r.referredUserId) : null;
        referrals.push({
          ...r.toObject(),
          id: r._id,
          referrerName: u1 ? u1.fullName : null,
          referrerEmail: u1 ? u1.email : null,
          referrerCredit: u1 ? Number(u1.credit || 0) : 0,
          referredName: u2 ? u2.fullName : null,
          referredEmail: u2 ? u2.email : null,
          referredCredit: u2 ? Number(u2.credit || 0) : 0
        });
      }

      return response.json({
        referrals,
        users
      });
    } catch (error) {
      console.error("Admin referrals fetch error:", error);
      return response.status(500).json({
        message: "Unable to load referrals dashboard",
        detail: error.message,
      });
    }
  });

  router.patch("/referrals/:referralId/grant", requireAdmin, async (request, response) => {
    try {
      const referralId = Number(request.params.referralId);
      const amount = Number(request.body.amount || 50.00);

      if (!referralId) {
        return response.status(400).json({ message: "Referral ID is required" });
      }
      if (isNaN(amount) || amount <= 0) {
        return response.status(400).json({ message: "Amount must be a positive number" });
      }

      const ref = await Referral.findById(referralId);
      if (!ref) {
        return response.status(404).json({ message: "Referral relationship not found" });
      }

      const referrer = await User.findById(ref.referrerUserId);
      if (referrer) {
        referrer.credit = (referrer.credit || 0) + amount;
        await referrer.save();
      }

      ref.rewardGranted = true;
      await ref.save();

      return response.json({ message: `Reward credit of ₹${amount} granted successfully` });
    } catch (error) {
      console.error("Admin grant referral reward error:", error);
      return response.status(500).json({
        message: "Unable to grant reward credit",
        detail: error.message,
      });
    }
  });

  router.patch("/referrals/:referralId/revoke", requireAdmin, async (request, response) => {
    try {
      const referralId = Number(request.params.referralId);
      const amount = Number(request.body.amount || 50.00);

      if (!referralId) {
        return response.status(400).json({ message: "Referral ID is required" });
      }
      if (isNaN(amount) || amount <= 0) {
        return response.status(400).json({ message: "Amount must be a positive number" });
      }

      const ref = await Referral.findById(referralId);
      if (!ref) {
        return response.status(404).json({ message: "Referral relationship not found" });
      }

      const referrer = await User.findById(ref.referrerUserId);
      if (referrer) {
        referrer.credit = Math.max(0, (referrer.credit || 0) - amount);
        await referrer.save();
      }

      ref.rewardGranted = false;
      await ref.save();

      return response.json({ message: `Reward credit of ₹${amount} revoked successfully` });
    } catch (error) {
      console.error("Admin revoke referral reward error:", error);
      return response.status(500).json({
        message: "Unable to revoke reward credit",
        detail: error.message,
      });
    }
  });

  router.patch("/users/:userId/credit", requireAdmin, async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      const credit = Number(request.body.credit);

      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }
      if (isNaN(credit) || credit < 0) {
        return response.status(400).json({ message: "Credit must be a non-negative number" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return response.status(404).json({ message: "User not found" });
      }

      user.credit = credit;
      await user.save();

      return response.json({ message: "User credit balance updated successfully" });
    } catch (error) {
      console.error("Admin user credit update error:", error);
      return response.status(500).json({
        message: "Unable to update user credit balance",
        detail: error.message,
      });
    }
  });

  return router;
};
