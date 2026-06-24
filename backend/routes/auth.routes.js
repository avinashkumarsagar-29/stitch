const express = require("express");
const webpush = require("web-push");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const LoginOtp = require("../models/LoginOtp");
const Referral = require("../models/Referral");
const {
  normalizePhoneNumber,
  isValidEmail,
  isValidPhoneNumber,
  isValidFullName,
  isValidPassword,
} = require("../utils/validators");
const { generateOtp, sendOtpEmail } = require("../utils/otp");
const { createAuthToken } = require("../utils/jwt");
const { generateUniqueReferralCode } = require("../services/referral.service");
const { getAppSettings } = require("../services/settings.service");

module.exports = (io) => {
  const router = express.Router();
  const otpExpiryMinutes = 5;

  router.post("/register", async (request, response) => {
    try {
      const fullName = String(request.body.fullName || "").trim();
      const email = String(request.body.email || "").trim().toLowerCase();
      const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);
      const password = String(request.body.password || "");
      const role = String(request.body.role || "user").toLowerCase();
      const referralCodeUsed = String(request.body.referralCodeUsed || "").trim();

      if (!fullName || !email || !phoneNumber || !password) {
        return response.status(400).json({
          message: "Full name, email, phone number and password are required",
        });
      }

      if (!isValidFullName(fullName)) {
        return response.status(400).json({
          message: "Please enter a valid full name (minimum 3 characters, alphabets and spaces only)",
        });
      }

      if (!isValidEmail(email)) {
        return response.status(400).json({
          message: "Please enter a valid email address",
        });
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        return response.status(400).json({
          message: "Please enter a valid phone number (10 to 15 digits)",
        });
      }

      if (!["user", "tailor"].includes(role)) {
        return response.status(400).json({
          message: "Role must be 'user' or 'tailor'",
        });
      }

      if (!isValidPassword(password)) {
        return response.status(400).json({
          message: "Password must be at least 6 characters, and contain at least one uppercase letter, one lowercase letter, one digit, and one special character (e.g. @, $, !, %, *, ?).",
        });
      }

      const appSettings = await getAppSettings();
      if (appSettings.disableNewRegistrations) {
        return response.status(503).json({
          message: "New registrations are temporarily disabled",
        });
      }

      let referrerUserId = null;
      if (referralCodeUsed) {
        const referrer = await User.findOne({ referralCode: referralCodeUsed });
        if (!referrer) {
          return response.status(400).json({
            message: "Invalid referral code",
          });
        }
        referrerUserId = referrer._id;
      }

      const existingUser = await User.findOne({
        $or: [{ email }, { phoneNumber }]
      });

      if (existingUser) {
        return response.status(409).json({
          message: "Email or phone number is already registered",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const referralCode = await generateUniqueReferralCode();

      // 1. Save to MongoDB (sequence _id generated automatically by pre-save hook)
      const mongoUser = new User({
        fullName,
        email,
        phoneNumber,
        passwordHash,
        role,
        plan: "Free",
        referralCode,
        credit: 0
      });
      await mongoUser.save();
      io.emit("data:updated", { type: "users" });
      io.emit("admin:new-user", {
        fullName: mongoUser.fullName,
        email: mongoUser.email,
        createdAt: new Date().toISOString(),
      });

      // Send push notification to all subscribed admins
      if (global.pushSubscriptions && global.pushSubscriptions.size > 0) {
        global.pushSubscriptions.forEach(async (data, adminId) => {
          try {
            const { subscription, themeColors } = data;
            const themedPayload = JSON.stringify({
              title: "New User Registered! 👤",
              body: `${mongoUser.fullName} (${mongoUser.email}) just joined Stitch`,
              icon: themeColors?.icon || "/logo.png",
              badge: "/logo.png",
              bgColor: themeColors?.bg || "#ffffff",
              accentColor: themeColors?.accent || "#c322f4",
              url: "/admin/users",
              tag: "new-user-" + Date.now(),
            });
            await webpush.sendNotification(subscription, themedPayload);
          } catch (err) {
            if (err.statusCode === 410) {
              global.pushSubscriptions.delete(adminId); // expired subscription
            }
          }
        });
      }

      if (referrerUserId) {
        const referral = new Referral({
          referrerUserId,
          referredUserId: mongoUser._id,
          referralCode: referralCodeUsed,
          rewardGranted: false
        });
        await referral.save();
      }

      return response.status(201).json({
        message: "Registration successful",
        user: {
          id: mongoUser._id,
          fullName: mongoUser.fullName,
          email: mongoUser.email,
          phoneNumber: mongoUser.phoneNumber,
          role: mongoUser.role,
          plan: mongoUser.plan || "Free",
          referralCode: mongoUser.referralCode,
          credit: Number(mongoUser.credit || 0),
        }
      });
    } catch (error) {
      console.error("Register error:", error);
      return response.status(500).json({
        message: "Unable to register user",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.originalError?.message || error.message,
      });
    }
  });

  router.post("/request-otp", async (request, response) => {
    try {
      const email = String(request.body.email || "").trim().toLowerCase();

      if (!email) {
        return response.status(400).json({
          message: "Email is required",
        });
      }

      if (!isValidEmail(email)) {
        return response.status(400).json({
          message: "Please enter a valid email address",
        });
      }

      // Parallel: fetch user + check rate limit simultaneously
      const [user, requestCount] = await Promise.all([
        User.findOne({ email }).lean(),
        process.env.NODE_ENV === "production"
          ? LoginOtp.countDocuments({
              email,
              createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }
            })
          : Promise.resolve(0)
      ]);

      if (!user) {
        return response.status(404).json({ message: "Email is not registered" });
      }

      if (user.isBanned) {
        return response.status(403).json({ message: "Your account has been deactivated." });
      }

      if (requestCount >= 3) {
        return response.status(429).json({
          message: "Too many OTP requests. Please wait before requesting another OTP."
        });
      }

      const otpCode = generateOtp();

      // Parallel: save OTP + send email simultaneously
      const loginOtp = new LoginOtp({
        email,
        otpCode,
        expiresAt: new Date(Date.now() + otpExpiryMinutes * 60 * 1000)
      });

      const [, emailResult] = await Promise.all([
        loginOtp.save(),
        sendOtpEmail(user.email, user.fullName, otpCode)
      ]);

      return response.json({
        message: emailResult.sent
          ? "OTP sent successfully"
          : "OTP generated successfully. Configure email settings to send it.",
        devOtp: emailResult.sent ? undefined : otpCode,
      });
    } catch (error) {
      console.error("OTP request error:", error);
      return response.status(500).json({
        message: "Unable to send OTP",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.post("/verify-otp", async (request, response) => {
    try {
      const email = String(request.body.email || "").trim().toLowerCase();
      const otpCode = String(request.body.otp || "").trim();

      if (!email || !otpCode) {
        return response.status(400).json({
          message: "Email and OTP are required",
        });
      }

      // Retrieve the latest active (unused & unexpired) OTP record for this email
      const activeOtp = await LoginOtp.findOne({
        email,
        usedAt: null,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (!activeOtp) {
        return response.status(401).json({
          message: "Invalid or expired OTP",
        });
      }

      if (activeOtp.attempts >= 3) {
        return response.status(429).json({
          message: "Too many failed attempts. Please request a new OTP.",
        });
      }

      if (activeOtp.otpCode !== otpCode) {
        // Increment failed attempts. If total attempts reach 3, invalidate the OTP.
        activeOtp.attempts += 1;
        if (activeOtp.attempts >= 3) {
          activeOtp.usedAt = new Date();
        }
        await activeOtp.save();

        if (activeOtp.attempts >= 3) {
          return response.status(429).json({
            message: "Too many failed attempts. This OTP has been invalidated. Please request a new OTP.",
          });
        }

        return response.status(401).json({
          message: "Invalid or expired OTP",
        });
      }

      // OTP is correct. Mark it as used.
      activeOtp.usedAt = new Date();
      await activeOtp.save();

      const user = await User.findOne({ email });

      if (!user) {
        return response.status(404).json({
          message: "User not found",
        });
      }

      if (user.isBanned) {
        return response.status(403).json({
          message: "Your account has been deactivated.",
        });
      }

      return response.json({
        message: "Login successful",
        token: createAuthToken(user),
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          plan: user.plan || "Free",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          address: user.address || "",
          image: user.image || "",
          referralCode: user.referralCode,
          credit: user.credit !== undefined ? Number(user.credit) : 0,
        },
      });
    } catch (error) {
      console.error("OTP verify error:", error);
      return response.status(500).json({
        message: "Unable to login",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.post("/google-login", async (request, response) => {
    try {
      const { email, fullName, image } = request.body;

      if (!email) {
        return response.status(400).json({
          message: "Email is required",
        });
      }

      // Check if the user already exists by email
      let user = await User.findOne({ email });

      if (user && user.isBanned) {
        return response.status(403).json({
          message: "Your account has been deactivated.",
        });
      }

      if (!user) {
        return response.json({
          isNewUser: true,
          googleData: {
            email,
            fullName: fullName || email.split("@")[0],
            image: image || null,
          },
        });
      }

      return response.json({
        message: "Login successful",
        token: createAuthToken(user),
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber || "",
          role: user.role,
          plan: user.plan || "Free",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          address: user.address || "",
          image: user.image || "",
          referralCode: user.referralCode,
          credit: user.credit !== undefined ? Number(user.credit) : 0,
        },
      });
    } catch (error) {
      console.error("Google login error:", error);
      return response.status(500).json({
        message: "Unable to complete Google login",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  router.post("/google-register", async (request, response) => {
    try {
      const { email, fullName, image, phoneNumber, role } = request.body;

      if (!email) {
        return response.status(400).json({
          message: "Email is required",
        });
      }

      if (!isValidEmail(email)) {
        return response.status(400).json({
          message: "Please enter a valid email address",
        });
      }

      if (fullName && !isValidFullName(fullName)) {
        return response.status(400).json({
          message: "Please enter a valid full name (minimum 3 characters, alphabets and spaces only)",
        });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!phoneNumber || !normalizedPhone) {
        return response.status(400).json({
          message: "Phone number is required",
        });
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        return response.status(400).json({
          message: "Please enter a valid phone number (10 to 15 digits)",
        });
      }

      const userRole = String(role || "user").toLowerCase();
      if (!["user", "tailor"].includes(userRole)) {
        return response.status(400).json({
          message: "Role must be 'user' or 'tailor'",
        });
      }

      // Check duplicate in MongoDB
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { phoneNumber: normalizedPhone }]
      });

      if (existingUser) {
        return response.status(409).json({
          message: "Email or phone number is already registered",
        });
      }

      const referralCode = await generateUniqueReferralCode();
      const randomPasswordHash = "GOOGLE_AUTH_" + Math.random().toString(36).substring(2, 12);

      const mongoUser = new User({
        fullName: fullName || email.split("@")[0],
        email: email.toLowerCase(),
        phoneNumber: normalizedPhone,
        passwordHash: randomPasswordHash,
        role: userRole,
        plan: "Free",
        referralCode,
        image: image || null,
        credit: 0,
      });

      await mongoUser.save();
      io.emit("data:updated", { type: "users" });

      return response.status(201).json({
        message: "Registration successful",
        token: createAuthToken(mongoUser),
        user: {
          id: mongoUser.id,
          fullName: mongoUser.fullName,
          email: mongoUser.email,
          phoneNumber: mongoUser.phoneNumber || "",
          role: mongoUser.role,
          plan: mongoUser.plan || "Free",
          firstName: mongoUser.firstName || "",
          lastName: mongoUser.lastName || "",
          address: mongoUser.address || "",
          image: mongoUser.image || "",
          referralCode: mongoUser.referralCode,
          credit: mongoUser.credit !== undefined ? Number(mongoUser.credit) : 0,
        },
      });
    } catch (error) {
      console.error("Google register error:", error);
      return response.status(500).json({
        message: "Unable to complete Google registration",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    }
  });

  return router;
};
