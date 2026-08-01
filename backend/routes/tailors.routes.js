const express = require("express");
const JoinApplication = require("../models/JoinApplication");
const User = require("../models/User");
const Review = require("../models/Review");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { normalizePhoneNumber } = require("../utils/validators");
const { uploadProfile, uploadProfileImage } = require("../cloudinary");

const geocodeCache = {};

async function geocodeAddress(address) {
  if (!address || address.length < 3) return null;
  const cleanAddress = address.trim();
  if (geocodeCache[cleanAddress]) {
    return geocodeCache[cleanAddress];
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddress)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "StitchTailoringApp/1.0"
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
      geocodeCache[cleanAddress] = coords;
      return coords;
    }
  } catch (error) {
    console.error("Geocoding failed for:", cleanAddress, error);
  }
  return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

module.exports = (io) => {
  const router = express.Router();

  router.post("/api/join", uploadProfile.single("image"), async (request, response) => {
    try {
      const firstName = String(request.body.firstName || "").trim();
      const lastName = String(request.body.lastName || "").trim();
      const email = String(request.body.email || "").trim().toLowerCase();
      const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);
      const experience = String(request.body.experience || "").trim();
      const location = String(request.body.location || "").trim();
      const image = request.file
        ? await uploadProfileImage(request.file.buffer)
        : (request.body.image || null);
      const plan = String(request.body.plan || "Free").trim();

      if (!firstName || !lastName || !email || !phoneNumber || !experience || !location) {
        return response.status(400).json({
          message: "First name, last name, email, phone number, experience, and location are required",
        });
      }

      const application = new JoinApplication({
        firstName,
        lastName,
        email,
        phoneNumber,
        experience,
        location,
        image,
        plan,
        status: "pending"
      });
      await application.save();
      io.emit("data:updated", { type: "applications" });

      // Auto-update User profile if a matching user is registered (by email or phone)
      let updatedUserObj = null;
      let updatedProfileObj = null;

      const userCheck = await User.findOne({
        $or: [
          { email },
          { phoneNumber }
        ]
      });

      if (userCheck) {
        const fullName = `${firstName} ${lastName}`.trim();
        userCheck.fullName = fullName;
        userCheck.firstName = firstName;
        userCheck.lastName = lastName;
        userCheck.address = location;
        userCheck.image = image;
        await userCheck.save();

        updatedUserObj = {
          id: userCheck._id,
          fullName: userCheck.fullName,
          email: userCheck.email,
          phoneNumber: userCheck.phoneNumber,
          role: userCheck.role,
          plan: userCheck.plan || "Free",
          firstName: userCheck.firstName || "",
          lastName: userCheck.lastName || "",
          address: userCheck.address || "",
          image: userCheck.image || "",
        };

        updatedProfileObj = {
          fullName: userCheck.fullName,
          firstName: userCheck.firstName || "",
          lastName: userCheck.lastName || "",
          email: userCheck.email,
          phone: userCheck.phoneNumber,
          address: userCheck.address || "",
          image: userCheck.image || "",
          role: userCheck.role,
          plan: userCheck.plan || "Free",
        };
      }

      return response.status(201).json({
        message: "Application submitted successfully",
        application,
        user: updatedUserObj,
        profile: updatedProfileObj,
      });
    } catch (error) {
      console.error("Join application error:", error);
      return response.status(500).json({
        message: "Unable to submit application",
        detail: error.message,
      });
    }
  });

  router.get("/api/join", requireAuth, async (request, response) => {
    try {
      let applications;
      if (request.user?.role === "admin") {
        applications = await JoinApplication.find().sort({ createdAt: -1 });
      } else {
        const query = {
          $or: [
            { email: request.user?.email ? request.user.email.toLowerCase().trim() : undefined },
            { phoneNumber: request.user?.phoneNumber ? request.user.phoneNumber.trim() : undefined }
          ].filter(Boolean)
        };
        applications = (query.$or && query.$or.length > 0)
          ? await JoinApplication.find(query).sort({ createdAt: -1 })
          : [];
      }

      return response.json({
        applications,
      });
    } catch (error) {
      console.error("Join list error:", error);
      return response.status(500).json({
        message: "Unable to load applications",
        detail: error.message,
      });
    }
  });

  router.get("/api/tailors", async (request, response) => {
    try {
      const latStr = request.query.lat;
      const lonStr = request.query.lon;
      const location = String(request.query.location || "").trim().toLowerCase();

      const isCoordsSearch = latStr !== undefined && lonStr !== undefined;
      const searchLat = isCoordsSearch ? parseFloat(latStr) : null;
      const searchLon = isCoordsSearch ? parseFloat(lonStr) : null;

      if (!location && !isCoordsSearch) {
        return response.status(400).json({
          message: "Pickup location or lat/lon coordinates are required",
        });
      }

      const applications = await JoinApplication.find({
        status: { $in: ['approved', 'pending'] }
      });

      const planWeights = {
        'Pro': 3,
        'Plus': 2,
        'Free': 1
      };

      const enrichedTailors = [];
      for (const ja of applications) {
        // Find matching User record for the tailor application
        const userTailor = await User.findOne({
          $or: [
            { email: ja.email ? ja.email.toLowerCase().trim() : undefined },
            { phoneNumber: ja.phoneNumber ? ja.phoneNumber.trim() : undefined }
          ].filter(Boolean)
        });

        const searchIds = [ja._id];
        if (userTailor) {
          searchIds.push(userTailor._id);
        }

        const reviews = await Review.find({ tailorApplicationId: { $in: searchIds } });
        const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

        enrichedTailors.push({
          id: ja._id,
          firstName: ja.firstName,
          lastName: ja.lastName,
          email: ja.email,
          phoneNumber: ja.phoneNumber,
          experience: ja.experience,
          location: ja.location,
          image: ja.image,
          plan: ja.plan || "Free",
          status: ja.status,
          createdAt: ja.createdAt,
          avgRating: Number(avgRating.toFixed(2)),
          reviewCount: reviews.length
        });
      }

      let tailors = [];

      if (isCoordsSearch) {
        const tailorsWithDistancePromises = enrichedTailors.map(async (tailor) => {
          const tailorCoords = await geocodeAddress(tailor.location);
          let distance = null;
          if (tailorCoords) {
            distance = calculateDistance(searchLat, searchLon, tailorCoords.lat, tailorCoords.lon);
          }
          return {
            id: tailor.id,
            name: `${tailor.firstName} ${tailor.lastName}`.trim(),
            email: tailor.email,
            phoneNumber: tailor.phoneNumber,
            experience: tailor.experience,
            location: tailor.location,
            image: tailor.image,
            plan: tailor.plan,
            avgRating: tailor.avgRating,
            reviewCount: tailor.reviewCount,
            latitude: tailorCoords ? tailorCoords.lat : null,
            longitude: tailorCoords ? tailorCoords.lon : null,
            distance: distance !== null ? Number(distance.toFixed(2)) : null,
          };
        });

        const resolvedTailors = await Promise.all(tailorsWithDistancePromises);
        tailors = resolvedTailors
          .filter((t) => t.distance !== null && t.distance >= 0 && t.distance <= 2)
          .sort((a, b) => {
            if (a.distance !== b.distance) {
              return a.distance - b.distance;
            }
            const ratingA = a.avgRating || 0;
            const ratingB = b.avgRating || 0;
            if (ratingB !== ratingA) {
              return ratingB - ratingA;
            }
            const weightA = planWeights[a.plan] || 1;
            const weightB = planWeights[b.plan] || 1;
            return weightB - weightA;
          });
      } else {
        const searchWords = location
          .split(/[\s,.-]+/)
          .map((word) => word.trim())
          .filter((word) => word.length >= 3);

        tailors = enrichedTailors
          .filter((tailor) => {
            const tailorLocation = String(tailor.location || "").toLowerCase();
            return (
              tailorLocation.includes(location) ||
              location.includes(tailorLocation) ||
              searchWords.some((word) => tailorLocation.includes(word))
            );
          })
          .map((tailor) => ({
            id: tailor.id,
            name: `${tailor.firstName} ${tailor.lastName}`.trim(),
            email: tailor.email,
            phoneNumber: tailor.phoneNumber,
            experience: tailor.experience,
            location: tailor.location,
            image: tailor.image,
            plan: tailor.plan,
            avgRating: tailor.avgRating,
            reviewCount: tailor.reviewCount,
          }))
          .sort((a, b) => {
            const ratingA = a.avgRating || 0;
            const ratingB = b.avgRating || 0;
            if (ratingB !== ratingA) {
              return ratingB - ratingA;
            }
            const weightA = planWeights[a.plan] || 1;
            const weightB = planWeights[b.plan] || 1;
            return weightB - weightA;
          });
      }

      return response.json({
        tailors,
      });
    } catch (error) {
      console.error("Tailor search error:", error);
      return response.status(500).json({
        message: "Unable to search tailors",
        detail: error.message,
      });
    }
  });

  router.get("/api/tailors/:tailorId", async (request, response) => {
    try {
      const tailorId = Number(request.params.tailorId);

      if (!tailorId) {
        return response.status(400).json({
          message: "Tailor id is required",
        });
      }

      let tailor = await JoinApplication.findById(tailorId);
      if (!tailor) {
        const userTailor = await User.findOne({ _id: tailorId, role: 'tailor' });
        if (userTailor) {
          tailor = {
            id: userTailor._id,
            firstName: userTailor.firstName || userTailor.fullName.split(' ')[0] || '',
            lastName: userTailor.lastName || userTailor.fullName.split(' ').slice(1).join(' ') || '',
            email: userTailor.email,
            phoneNumber: userTailor.phoneNumber,
            experience: "Professional Tailor Partner",
            location: userTailor.address || "Not provided",
            image: userTailor.image || null,
            plan: userTailor.plan || "Free",
          };
        }
      }

      if (!tailor) {
        return response.status(404).json({
          message: "Tailor not found",
        });
      }

      let searchIds = [tailorId];
      if (tailor.email || tailor.phoneNumber) {
        const userTailor = await User.findOne({
          $or: [
            { email: tailor.email ? tailor.email.toLowerCase().trim() : undefined },
            { phoneNumber: tailor.phoneNumber ? tailor.phoneNumber.trim() : undefined }
          ].filter(Boolean)
        });
        if (userTailor) {
          searchIds.push(userTailor._id);
        }
      }

      const matchingApp = await JoinApplication.findOne({
        $or: [
          { email: tailor.email ? tailor.email.toLowerCase().trim() : undefined },
          { phoneNumber: tailor.phoneNumber ? tailor.phoneNumber.trim() : undefined }
        ].filter(Boolean)
      });
      if (matchingApp) {
        searchIds.push(matchingApp._id);
      }

      searchIds = [...new Set(searchIds)];

      const reviews = await Review.find({ tailorApplicationId: { $in: searchIds } });
      const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      const reviewCount = reviews.length;

      return response.json({
        tailor: {
          id: tailor.id,
          name: `${tailor.firstName} ${tailor.lastName}`.trim(),
          email: tailor.email,
          phoneNumber: tailor.phoneNumber,
          experience: tailor.experience,
          location: tailor.location,
          image: tailor.image,
          plan: tailor.plan || "Free",
          avgRating: Number(avgRating.toFixed(2)),
          reviewCount,
        },
      });
    } catch (error) {
      console.error("Tailor detail error:", error);
      return response.status(500).json({
        message: "Unable to load tailor",
        detail: error.message,
      });
    }
  });

  return router;
};
