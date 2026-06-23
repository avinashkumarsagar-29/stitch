const express = require("express");
const BusinessOrder = require("../models/BusinessOrder");
const JoinApplication = require("../models/JoinApplication");
const User = require("../models/User");
const { requireAuth, getAuthenticatedUserId } = require("../middleware/auth");

module.exports = (io) => {
  const router = express.Router();

  router.post("/", requireAuth, async (request, response) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const { companyName, contactName, email, phoneNumber, businessType, quantity, requirements, targetDeliveryDate, location, tailorApplicationId } = request.body;

      if (!companyName || !contactName || !email || !phoneNumber || !businessType || !quantity) {
        return response.status(400).json({
          message: "Company name, contact name, email, phone number, business type, and quantity are required",
        });
      }

      const quantityNum = Number(quantity);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        return response.status(400).json({
          message: "Quantity must be a positive number",
        });
      }

      let tailorName = null;
      let tailorEmail = null;
      let tailorPhoneNumber = null;

      if (tailorApplicationId) {
        const t = await JoinApplication.findById(Number(tailorApplicationId));
        if (t) {
          tailorName = `${t.firstName} ${t.lastName}`.trim();
          tailorEmail = t.email;
          tailorPhoneNumber = t.phoneNumber;
        }
      }

      const businessOrder = await new BusinessOrder({
        userId,
        companyName,
        contactName,
        email,
        phoneNumber,
        businessType,
        quantity: quantityNum,
        requirements: requirements || null,
        targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : null,
        location: location || null,
        tailorApplicationId: tailorApplicationId ? Number(tailorApplicationId) : null,
        tailorName,
        tailorEmail,
        tailorPhoneNumber,
        status: "pending",
      }).save();

      return response.status(201).json({
        message: "Business order inquiry submitted successfully",
        businessOrder: businessOrder.toObject(),
      });
    } catch (error) {
      console.error("Create business order error:", error);
      return response.status(500).json({
        message: "Unable to submit business order inquiry",
        detail: error.message,
      });
    }
  });

  router.get("/", requireAuth, async (request, response) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";

      let businessOrders;
      if (userRole === "tailor") {
        const orderDocs = await BusinessOrder.find().sort({ createdAt: -1 });
        businessOrders = orderDocs.map((order) => order.toObject());
        const users = await User.find({ _id: { $in: businessOrders.map((order) => order.userId) } }).lean();
        const userNames = new Map(users.map((user) => [user._id, user.fullName]));
        businessOrders = businessOrders.map((order) => ({
          ...order,
          userFullName: userNames.get(order.userId) || null,
        }));
      } else {
        const orderDocs = await BusinessOrder.find({ userId }).sort({ createdAt: -1 });
        businessOrders = orderDocs.map((order) => order.toObject());
      }

      return response.json({
        businessOrders,
      });
    } catch (error) {
      console.error("Get business orders error:", error);
      return response.status(500).json({
        message: "Unable to load business orders",
        detail: error.message,
      });
    }
  });

  router.get("/:orderId", requireAuth, async (request, response) => {
    try {
      const orderId = Number(request.params.orderId);
      const userId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";
      const orderDoc = await BusinessOrder.findById(orderId);
      const order = orderDoc ? orderDoc.toObject() : null;
      if (!order) {
        return response.status(404).json({
          message: "Business order not found",
        });
      }

      if (userRole !== "tailor" && Number(order.userId) !== userId) {
        return response.status(403).json({
          message: "You can only track your own business orders",
        });
      }

      const owner = await User.findById(order.userId);
      order.userFullName = owner?.fullName || null;

      return response.json({
        businessOrder: order,
      });
    } catch (error) {
      console.error("Get business order error:", error);
      return response.status(500).json({
        message: "Unable to load business order details",
        detail: error.message,
      });
    }
  });

  router.patch("/:orderId/price", requireAuth, async (request, response) => {
    try {
      const orderId = Number(request.params.orderId);
      const { approxPrice } = request.body;
      const userRole = request.user?.role || "user";

      if (userRole !== "tailor") {
        return response.status(403).json({
          message: "Only tailor accounts can submit price quotes for bulk orders",
        });
      }

      if (!orderId || approxPrice === undefined || approxPrice === null) {
        return response.status(400).json({
          message: "Order ID and approxPrice are required",
        });
      }

      const priceNum = Number(approxPrice);
      if (isNaN(priceNum) || priceNum <= 0) {
        return response.status(400).json({
          message: "Quote price must be a positive number",
        });
      }

      const businessOrder = await BusinessOrder.findByIdAndUpdate(
        orderId,
        { approxPrice: priceNum, status: "quoted" },
        { new: true },
      );

      if (!businessOrder) {
        return response.status(404).json({
          message: "Business order not found",
        });
      }

      return response.json({
        message: "Price quote submitted successfully",
        businessOrder: businessOrder.toObject(),
      });
    } catch (error) {
      console.error("Submit business quote error:", error);
      return response.status(500).json({
        message: "Unable to submit price quote",
        detail: error.message,
      });
    }
  });

  router.patch("/:orderId/status", requireAuth, async (request, response) => {
    try {
      const orderId = Number(request.params.orderId);
      const { status } = request.body;
      const userId = getAuthenticatedUserId(request);
      const userRole = request.user?.role || "user";

      if (!orderId || !status) {
        return response.status(400).json({
          message: "Order ID and status are required",
        });
      }

      const allowedStatuses = ["pending", "quoted", "booked", "delivered", "cancelled"];
      if (!allowedStatuses.includes(status)) {
        return response.status(400).json({
          message: "Invalid status value",
        });
      }

      const order = await BusinessOrder.findById(orderId);
      if (!order) {
        return response.status(404).json({ message: "Business order not found" });
      }

      if (userRole === "user") {
        if (Number(order.userId) !== userId) {
          return response.status(403).json({ message: "You can only update status for your own business orders" });
        }

        // Customer can only mark as 'booked' (confirming quote) or 'cancelled'
        if (status !== "booked" && status !== "cancelled") {
          return response.status(400).json({ message: "Customers can only accept a quote or cancel the request" });
        }
      }

      order.status = status;
      if (status === "delivered") {
        order.deliveredAt = new Date();
      }
      await order.save();

      return response.json({
        message: "Business order status updated successfully",
        businessOrder: order.toObject(),
      });
    } catch (error) {
      console.error("Update business status error:", error);
      return response.status(500).json({
        message: "Unable to update status",
        detail: error.message,
      });
    }
  });

  return router;
};
