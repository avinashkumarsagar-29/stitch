const express = require("express");
const User = require("../models/User");
const Measurement = require("../models/Measurement");
const JoinApplication = require("../models/JoinApplication");
const { canAccessUser } = require("../middleware/auth");
const { normalizePhoneNumber } = require("../utils/validators");
const { uploadProfile, uploadProfileImage } = require("../cloudinary");

module.exports = (io) => {
  const router = express.Router();

  router.get("/:userId/profile", async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({ message: "You can only access your own profile" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return response.status(404).json({ message: "User not found" });
      }

      return response.json({
        profile: {
          fullName: user.fullName,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email,
          phone: user.phoneNumber,
          address: user.address || "",
          image: user.image || "",
          role: user.role,
          plan: user.plan || "Free",
          referralCode: user.referralCode,
          credit: user.credit !== undefined ? Number(user.credit) : 0,
        }
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return response.status(500).json({
        message: "Unable to load profile",
        detail: error.message,
      });
    }
  });

  router.get("/:userId/measurements", async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({ message: "You can only access your own measurements" });
      }

      const measurements = await Measurement.findOne({ userId });
      return response.json({
        measurements
      });
    } catch (error) {
      console.error("Get measurements error:", error);
      return response.status(500).json({
        message: "Unable to load measurements",
        detail: error.message,
      });
    }
  });

  router.put("/:userId/measurements", async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      const chest = request.body.chest !== undefined && request.body.chest !== "" ? Number(request.body.chest) : null;
      const waist = request.body.waist !== undefined && request.body.waist !== "" ? Number(request.body.waist) : null;
      const hip = request.body.hip !== undefined && request.body.hip !== "" ? Number(request.body.hip) : null;
      const shoulder = request.body.shoulder !== undefined && request.body.shoulder !== "" ? Number(request.body.shoulder) : null;
      const inseam = request.body.inseam !== undefined && request.body.inseam !== "" ? Number(request.body.inseam) : null;
      const height = request.body.height !== undefined && request.body.height !== "" ? Number(request.body.height) : null;
      const sleeve = request.body.sleeve !== undefined && request.body.sleeve !== "" ? Number(request.body.sleeve) : null;

      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({ message: "You can only update your own measurements" });
      }

      // 1. Dual Write: Save/Update in MongoDB
      let mongoMeasurement = await Measurement.findOne({ userId });
      if (mongoMeasurement) {
        mongoMeasurement.chest = chest;
        mongoMeasurement.waist = waist;
        mongoMeasurement.hip = hip;
        mongoMeasurement.shoulder = shoulder;
        mongoMeasurement.inseam = inseam;
        mongoMeasurement.height = height;
        mongoMeasurement.sleeve = sleeve;
        await mongoMeasurement.save();
      } else {
        mongoMeasurement = new Measurement({
          userId,
          chest,
          waist,
          hip,
          shoulder,
          inseam,
          height,
          sleeve
        });
        await mongoMeasurement.save();
      }

      return response.json({
        message: "Measurements saved successfully",
        measurements: { chest, waist, hip, shoulder, inseam, height, sleeve }
      });
    } catch (error) {
      console.error("Save measurements error:", error);
      return response.status(500).json({
        message: "Unable to save measurements",
        detail: error.message,
      });
    }
  });

  router.put("/:userId/measurements/calibrate", async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({ message: "You can only update your own measurements" });
      }

      const { aiEstimates, actualValues } = request.body;
      if (!aiEstimates || !actualValues) {
        return response.status(400).json({ message: "aiEstimates and actualValues are required" });
      }

      let mongoMeasurement = await Measurement.findOne({ userId });
      if (!mongoMeasurement) {
        mongoMeasurement = new Measurement({
          userId,
          calibrationFactors: {
            chest: 1.0,
            waist: 1.0,
            hip: 1.0,
            shoulder: 1.0,
            inseam: 1.0,
            sleeve: 1.0
          }
        });
      }

      if (!mongoMeasurement.calibrationFactors) {
        mongoMeasurement.calibrationFactors = {
          chest: 1.0,
          waist: 1.0,
          hip: 1.0,
          shoulder: 1.0,
          inseam: 1.0,
          sleeve: 1.0
        };
      }

      const keys = ["chest", "waist", "hip", "shoulder", "inseam", "sleeve"];
      for (const key of keys) {
        if (aiEstimates[key] !== undefined && actualValues[key] !== undefined) {
          const aiVal = Number(aiEstimates[key]);
          const actVal = Number(actualValues[key]);
          if (aiVal > 0 && actVal > 0) {
            let factor = actVal / aiVal;
            // Clamp factor to [0.7, 1.3]
            if (factor < 0.7) factor = 0.7;
            if (factor > 1.3) factor = 1.3;
            mongoMeasurement.calibrationFactors[key] = Number(factor.toFixed(4));
          }
        }
      }

      mongoMeasurement.markModified("calibrationFactors");
      await mongoMeasurement.save();

      return response.json({
        message: "Calibration saved",
        calibrationFactors: mongoMeasurement.calibrationFactors
      });
    } catch (error) {
      console.error("Calibrate measurements error:", error);
      return response.status(500).json({
        message: "Unable to save calibration",
        detail: error.message,
      });
    }
  });

  router.put("/:userId/profile", uploadProfile.single("image"), async (request, response) => {
    try {
      const userId = Number(request.params.userId);
      let fullName = String(request.body.fullName || "").trim();
      let firstName = String(request.body.firstName || "").trim();
      let lastName = String(request.body.lastName || "").trim();
      const email = String(request.body.email || "").trim().toLowerCase();
      const phone = normalizePhoneNumber(request.body.phone);
      const address = String(request.body.address || "").trim();
      const image = request.file
        ? await uploadProfileImage(request.file.buffer)
        : (request.body.image || null);

      if (!userId) {
        return response.status(400).json({ message: "User ID is required" });
      }

      if (!canAccessUser(request, userId)) {
        return response.status(403).json({ message: "You can only update your own profile" });
      }

      if (!fullName && (!firstName || !lastName)) {
        return response.status(400).json({
          message: "Full name, email, and phone number are required",
        });
      }

      if (!fullName) {
        fullName = `${firstName} ${lastName}`.trim();
      } else {
        const parts = fullName.split(/\s+/);
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }

      if (!email || !phone) {
        return response.status(400).json({
          message: "Email and phone number are required",
        });
      }

      // Check duplicate in MongoDB
      const duplicate = await User.findOne({
        $or: [{ email }, { phoneNumber: phone }],
        _id: { $ne: userId }
      });

      if (duplicate) {
        return response.status(409).json({
          message: "Email or phone number is already registered by another account",
        });
      }

      // Fetch original user from MongoDB to check original role & values
      const originalUser = await User.findById(userId);
      if (!originalUser) {
        return response.status(404).json({ message: "User not found" });
      }

      const oldEmail = originalUser.email;
      const oldPhone = originalUser.phoneNumber;

      // Update MongoDB
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          fullName,
          firstName,
          lastName,
          email,
          phoneNumber: phone,
          address,
          image,
        },
        { returnDocument: 'after' }
      );

      if (!updatedUser) {
        return response.status(404).json({ message: "User not found" });
      }

      // If user is a tailor, synchronize their profile information to JoinApplications in MongoDB
      if (updatedUser.role === "tailor") {
        await JoinApplication.updateMany(
          { $or: [{ email: oldEmail }, { phoneNumber: oldPhone }] },
          {
            firstName,
            lastName,
            email,
            phoneNumber: phone,
            location: address
          }
        );
      }

      return response.json({
        message: "Profile updated successfully",
        profile: {
          fullName: updatedUser.fullName,
          firstName: updatedUser.firstName || "",
          lastName: updatedUser.lastName || "",
          email: updatedUser.email,
          phone: updatedUser.phoneNumber,
          address: updatedUser.address || "",
          image: updatedUser.image || "",
          role: updatedUser.role,
          plan: updatedUser.plan || "Free",
          referralCode: updatedUser.referralCode,
          credit: updatedUser.credit !== undefined ? Number(updatedUser.credit) : 0,
        },
        user: {
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
          role: updatedUser.role,
          plan: updatedUser.plan || "Free",
          firstName: updatedUser.firstName || "",
          lastName: updatedUser.lastName || "",
          address: updatedUser.address || "",
          image: updatedUser.image || "",
          referralCode: updatedUser.referralCode,
          credit: updatedUser.credit !== undefined ? Number(updatedUser.credit) : 0,
        }
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return response.status(500).json({
        message: "Unable to update profile",
        detail: error.message,
      });
    }
  });

  return router;
};
