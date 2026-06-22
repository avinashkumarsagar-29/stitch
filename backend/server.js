require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const https = require("https");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { connectMongo } = require("./db.mongo");
const User = require("./models/User");
const LoginOtp = require("./models/LoginOtp");
const Booking = require("./models/Booking");
const Measurement = require("./models/Measurement");
const Review = require("./models/Review");
const Referral = require("./models/Referral");
const JoinApplication = require("./models/JoinApplication");
const BusinessOrder = require("./models/BusinessOrder");
const Payment = require("./models/Payment");
const AppSettings = require("./models/AppSettings");
const Razorpay = require("razorpay");
const {
  uploadProfile,
  uploadCloth,
  uploadProfileImage,
  uploadClothImage,
} = require("./cloudinary");


// Initialize MongoDB Connection
connectMongo();

const app = express();
const port = Number(process.env.PORT || 4000);
const otpExpiryMinutes = 5;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim());

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/", (_request, response) => {
  response.json({
    name: "Stitch backend",
    status: "running",
    endpoints: {
      health: "/health",
      register: "POST /api/auth/register",
      requestOtp: "POST /api/auth/request-otp",
      verifyOtp: "POST /api/auth/verify-otp",
      bookings: "POST /api/bookings",
      tailors: "GET /api/tailors?location=pickup",
    },
  });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/health/db", async (_request, response) => {
  try {
    const mongoose = require("mongoose");
    const state = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    if (state === 1) {
      return response.json({
        status: "ok",
        database: mongoose.connection.name || "mongodb",
        connectionState: states[state]
      });
    } else {
      return response.status(500).json({
        status: "error",
        connectionState: states[state] || "unknown"
      });
    }
  } catch (error) {
    console.error("Database health error:", error);
    response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

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

function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d+]/g, "").trim();
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || "").trim().toLowerCase());
}

function isValidPhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidFullName(fullName) {
  const name = String(fullName || "").trim();
  return name.length >= 3 && /^[a-zA-Z\s]+$/.test(name);
}

function isValidPassword(password) {
  const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
  return passRegex.test(password);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;

  if (secret && secret.trim()) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured in production");
  }

  return "stitch-development-jwt-secret-change-me";
}

function signJwt(payload, expiresInSeconds = 60 * 60 * 24) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || "").split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Malformed token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp <= now) {
    throw new Error("Token expired");
  }

  return payload;
}

function createAuthToken(user) {
  return signJwt({
    sub: String(user.id),
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role || "user",
  });
}

async function authenticateApiRequest(request, response, next) {
  const authHeader = request.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return response.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    request.user = verifyJwt(token);
    const userId = Number(request.user.id);
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.isBanned) {
        return response.status(403).json({
          message: "Forbidden: Your account has been deactivated.",
        });
      }
    }
    return next();
  } catch (error) {
    console.error("JWT validation error:", error);
    return response.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

function requireAuth(request, response, next) {
  return authenticateApiRequest(request, response, next);
}

function requireAdmin(request, response, next) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (request.user?.role !== "admin") {
    return response.status(403).json({
      message: "Forbidden: Admin access required",
    });
  }

  if (superAdminEmail && request.user?.email !== superAdminEmail) {
    return response.status(403).json({
      message: "Forbidden: You do not have super admin privileges",
    });
  }

  next();
}

function getAuthenticatedUserId(request) {
  return Number(request.user?.id || request.user?.sub || 0);
}

function isAuthenticatedTailor(request) {
  return request.user?.role === "tailor";
}

function canAccessUser(request, userId) {
  return getAuthenticatedUserId(request) === Number(userId) || request.user?.role === "admin";
}

async function getAppSettings() {
  try {
    const settings = await AppSettings.find({
      key: { $in: ["disableNewRegistrations", "maintenanceMode"] }
    });

    return settings.reduce(
      (settingsMap, row) => ({
        ...settingsMap,
        [row.key]: String(row.value).toLowerCase() === "true",
      }),
      {
        disableNewRegistrations: false,
        maintenanceMode: false,
      }
    );
  } catch (error) {
    console.error("getAppSettings error:", error);
    return {
      disableNewRegistrations: false,
      maintenanceMode: false,
    };
  }
}

function formatSmsPhoneNumber(phoneNumber) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (normalizedPhoneNumber.startsWith("+")) {
    return normalizedPhoneNumber;
  }

  if (/^\d{10}$/.test(normalizedPhoneNumber)) {
    return `+91${normalizedPhoneNumber}`;
  }

  return normalizedPhoneNumber;
}

function postForm(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: responseBody,
          });
        });
      },
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function isConfiguredSecret(value, placeholder) {
  return Boolean(value && value.trim() && value !== placeholder);
}

async function sendOtpSms(phoneNumber, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  const isSmsConfigured =
    isConfiguredSecret(accountSid, "your_twilio_account_sid") &&
    isConfiguredSecret(authToken, "your_twilio_auth_token") &&
    isConfiguredSecret(fromPhoneNumber, "+15551234567");

  if (!isSmsConfigured) {
    console.log(`SMS not configured. OTP for ${phoneNumber}: ${otpCode}`);
    return { sent: false };
  }

  const smsBody = new URLSearchParams({
    To: formatSmsPhoneNumber(phoneNumber),
    From: fromPhoneNumber,
    Body: `Your Stitch login OTP is ${otpCode}. It expires in ${otpExpiryMinutes} minutes.`,
  }).toString();
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const result = await postForm(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    smsBody,
    {
      Authorization: `Basic ${authHeader}`,
    },
  );

  if (!result.ok) {
    throw new Error(`Twilio SMS failed with status ${result.statusCode}: ${result.body}`);
  }

  return { sent: true };
}

async function sendOtpEmail(userEmail, userName, otpCode) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  const isMailConfigured = host && port && user && pass;

  const subject = "Your Stitch Login OTP";
  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Hi ${userName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Please use the following One-Time Password (OTP) to complete your login. This OTP is valid for 5 minutes. Do not share it with anyone.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Your Secure OTP</p>
        <p style="margin: 12px 0 0 0; font-size: 38px; font-weight: 900; color: #c322f4; letter-spacing: 6px; font-family: monospace;">${otpCode}</p>
      </div>

      <p style="font-size: 12px; line-height: 1.6; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        If you did not request this, please ignore this email.
      </p>

      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this because you requested a login OTP on Stitch.</p>
      </div>
    </div>
  `;

  if (!isMailConfigured) {
    const logFilePath = path.join(__dirname, "mock_emails.log");
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${userEmail}
FROM: ${from}
SUBJECT: ${subject}
BODY:
${htmlContent}
========================================
\n`;
    try {
      fs.appendFileSync(logFilePath, logEntry, "utf8");
      console.log(`Mock OTP email logged successfully to ${logFilePath}`);
    } catch (err) {
      console.error("Failed to write mock OTP email to log file:", err);
    }
    return { sent: false, mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    console.log("OTP Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email via SMTP:", error);
    throw error;
  }
}

async function sendBookingEmail(userEmail, booking) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  const isMailConfigured = host && port && user && pass;

  const subject = `Booking Confirmation - Stitch Custom Booking`;
  const trackingLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/track?id=${booking.trackingCode || booking.id}`;

  const htmlContent = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Greeting from Stitch!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Thank you for booking your custom tailoring service with Stitch. We have successfully received and confirmed your order details.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Your Order Tracking Code</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #c322f4; letter-spacing: 2px;">${booking.trackingCode}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Use this 7-digit code to track your order progress anytime.</p>
      </div>

      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-top: 24px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af; width: 40%;">Cloth Category:</td>
          <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${booking.clothCategory}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Material:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.material}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Approximate Price:</td>
          <td style="padding: 6px 0; color: #c322f4; font-weight: 700;">₹${booking.approxPrice}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Pickup Location:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.pickupLocation}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Drop-off Location:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.dropoffLocation}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Scheduled Date:</td>
          <td style="padding: 6px 0; color: #1f2937;">${new Date(booking.bookingDate).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Scheduled Time:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.bookingTime instanceof Date
      ? `${String(booking.bookingTime.getUTCHours()).padStart(2, '0')}:${String(booking.bookingTime.getUTCMinutes()).padStart(2, '0')}`
      : String(booking.bookingTime).includes("T")
        ? String(booking.bookingTime).split("T")[1].slice(0, 5)
        : String(booking.bookingTime).slice(0, 5)
    }</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${trackingLink}" style="display: inline-block; background-color: #c322f4; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(195, 34, 244, 0.2); transition: all 0.2s;">Track Order Now</a>
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this email because you registered on Stitch.</p>
      </div>
    </div>
  `;

  if (!isMailConfigured) {
    const logFilePath = path.join(__dirname, "mock_emails.log");
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${userEmail}
FROM: ${from}
SUBJECT: ${subject}
BODY:
${htmlContent}
========================================
\n`;
    try {
      fs.appendFileSync(logFilePath, logEntry, "utf8");
      console.log(`Mock email logged successfully to ${logFilePath}`);
    } catch (err) {
      console.error("Failed to write mock email to log file:", err);
    }
    return { sent: false, mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}

async function sendPriceQuoteEmail(userEmail, booking) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  const isMailConfigured = host && port && user && pass;

  const subject = `New Price Quote for your Stitch Booking - ${booking.trackingCode || booking.id}`;
  const trackingLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/notifications`;

  const htmlContent = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Hello ${booking.userFullName || 'Valued Customer'},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Great news! A tailor has reviewed your tailoring request for order <strong>#${booking.trackingCode}</strong> and provided a price quote.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Tailor's Price Quote</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #c322f4; letter-spacing: 2px;">₹${booking.approxPrice}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Please review and confirm this quote to proceed with payment.</p>
      </div>

      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-top: 24px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af; width: 40%;">Cloth Category:</td>
          <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${booking.clothCategory || ''}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Material:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.material || ''}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Tailor Partner:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.tailorName || 'Assigned Tailor'}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${trackingLink}" style="display: inline-block; background-color: #c322f4; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(195, 34, 244, 0.2); transition: all 0.2s;">Review & Pay Now</a>
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this email because you registered on Stitch.</p>
      </div>
    </div>
  `;

  if (!isMailConfigured) {
    const logFilePath = path.join(__dirname, "mock_emails.log");
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${userEmail}
FROM: ${from}
SUBJECT: ${subject}
BODY:
${htmlContent}
========================================
\n`;
    try {
      fs.appendFileSync(logFilePath, logEntry, "utf8");
      console.log(`Mock email logged successfully to ${logFilePath}`);
    } catch (err) {
      console.error("Failed to write mock email to log file:", err);
    }
    return { sent: false, mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    console.log("Price Quote Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}

app.post("/api/auth/register", async (request, response) => {
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

app.post("/api/auth/request-otp", async (request, response) => {
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

    // Rate Limiting Check: Max 3 OTP requests in the last 10 minutes (only in production)
    if (process.env.NODE_ENV === "production") {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const requestCount = await LoginOtp.countDocuments({
        email,
        createdAt: { $gt: tenMinutesAgo }
      });

      if (requestCount >= 3) {
        return response.status(429).json({
          message: "Too many OTP requests. Please wait before requesting another OTP.",
        });
      }
    }

    const user = await User.findOne({ email });

    if (!user) {
      return response.status(404).json({
        message: "Email is not registered",
      });
    }

    if (user.isBanned) {
      return response.status(403).json({
        message: "Your account has been deactivated.",
      });
    }

    const otpCode = generateOtp();
    const loginOtp = new LoginOtp({
      email,
      otpCode,
      expiresAt: new Date(Date.now() + otpExpiryMinutes * 60 * 1000)
    });
    await loginOtp.save();

    const emailResult = await sendOtpEmail(user.email, user.fullName, otpCode);

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

app.post("/api/auth/verify-otp", async (request, response) => {
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

app.post("/api/auth/google-login", async (request, response) => {
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

app.post("/api/auth/google-register", async (request, response) => {
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

app.use("/api", authenticateApiRequest);

app.use("/api", async (request, response, next) => {
  if (request.user?.role === "admin") {
    return next();
  }

  try {
    const appSettings = await getAppSettings();
    if (appSettings.maintenanceMode) {
      return response.status(503).json({
        message: "Stitch is temporarily in maintenance mode",
      });
    }
    return next();
  } catch (error) {
    console.error("Maintenance mode check error:", error);
    return response.status(500).json({
      message: "Unable to verify application availability",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/admin/summary", requireAdmin, async (_request, response) => {
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

app.get("/api/admin/settings", requireAdmin, async (_request, response) => {
  try {
    const settings = await getAppSettings();
    const mongoose = require("mongoose");
    const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });

    return response.json({
      settings,
      admins,
      backendHealth: {
        status: "ok",
        database: mongoose.connection.name || "mongodb",
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

app.patch("/api/admin/settings", requireAdmin, async (request, response) => {
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

app.post("/api/admin/admins", requireAdmin, async (request, response) => {
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

app.delete("/api/admin/admins/:userId", requireAdmin, async (request, response) => {
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

app.get("/api/admin/users", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/users/:userId/role", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/users/:userId/ban", requireAdmin, async (request, response) => {
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

app.get("/api/admin/users/:userId/bookings", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/join/:applicationId/approve", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/join/:applicationId/reject", requireAdmin, async (request, response) => {
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

app.get("/api/admin/bookings", requireAdmin, async (request, response) => {
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

app.get("/api/admin/bookings/:bookingId", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/bookings/:bookingId/status", requireAdmin, async (request, response) => {
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

    return response.json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("Admin override booking status error:", error);
    return response.status(500).json({
      message: "Unable to update booking status",
      detail: error.message,
    });
  }
});

app.get("/api/admin/business-orders", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/business-orders/:orderId", requireAdmin, async (request, response) => {
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

app.get("/api/admin/payments", requireAdmin, async (request, response) => {
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

app.get("/api/admin/reviews", requireAdmin, async (request, response) => {
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

    const [users, joinApps, averagesAggregation] = await Promise.all([
      User.find({ _id: { $in: userIds } }),
      JoinApplication.find({ _id: { $in: tailorIds } }),
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

    const reviews = [];
    for (const r of reviewsRaw) {
      const u = r.userId ? userMap.get(r.userId) : null;
      const ja = r.tailorApplicationId ? joinAppMap.get(r.tailorApplicationId) : null;

      const reviewObj = {
        ...r.toObject(),
        id: r._id,
        customerName: u ? u.fullName : null,
        customerEmail: u ? u.email : null,
        tailorName: ja ? `${ja.firstName} ${ja.lastName}`.trim() : null,
        tailorEmail: ja ? ja.email : null
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
      const avgInfo = averagesMap.get(ja._id);
      if (avgInfo) {
        averages.push({
          tailorId: ja._id,
          tailorName: `${ja.firstName} ${ja.lastName}`.trim(),
          tailorEmail: ja.email,
          averageRating: Number(avgInfo.averageRating.toFixed(2)),
          reviewCount: avgInfo.reviewCount
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

app.delete("/api/admin/reviews/:reviewId", requireAdmin, async (request, response) => {
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

app.get("/api/admin/referrals", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/referrals/:referralId/grant", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/referrals/:referralId/revoke", requireAdmin, async (request, response) => {
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

app.patch("/api/admin/users/:userId/credit", requireAdmin, async (request, response) => {
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

app.get("/api/users/:userId/profile", async (request, response) => {
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

app.get("/api/users/:userId/measurements", async (request, response) => {
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

app.put("/api/users/:userId/measurements", async (request, response) => {
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

app.put("/api/users/:userId/profile", uploadProfile.single("image"), async (request, response) => {
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

app.post("/api/bookings", requireAuth, async (request, response) => {
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

app.get("/api/bookings", requireAuth, async (request, response) => {
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

app.get("/api/bookings/:bookingId", requireAuth, async (request, response) => {
  try {
    const bookingIdParam = String(request.params.bookingId || "").trim();
    const bookingIdNum = Number(bookingIdParam) || 0;

    if (!bookingIdParam) {
      return response.status(400).json({
        message: "Booking id or tracking code is required",
      });
    }

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    // 1. Query MongoDB for the Booking
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

    // 2. Fetch related details from MongoDB.
    const userDoc = await User.findById(mongoBooking.userId);
    const measurementDoc = await Measurement.findOne({ userId: mongoBooking.userId });
    const reviewDoc = await Review.findOne({ bookingId: mongoBooking._id });

    // Build the flat shape expected by the frontend
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

        // Check if user is referred and has not had a booking confirmed yet
        // Query MongoDB Referral collection
        const referralDoc = await Referral.findOne({ referredUserId: userId });

        if (referralDoc) {
          // Count confirmed bookings in MongoDB
          const confirmedCount = await Booking.countDocuments({
            userId,
            _id: { $ne: bookingId },
            status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
          });
          if (confirmedCount === 0) {
            referralDiscountApplied = 50.00;
          }
        }

        // Check user available credit balance from User model
        const availableCredit = userDoc ? Number(userDoc.credit || 0) : 0;

        let tempPrice = totalBasePrice - referralDiscountApplied;
        if (tempPrice < 0) tempPrice = 0;

        creditApplied = Math.min(availableCredit, tempPrice);

        // Update MongoDB only
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


app.post("/api/bookings/:bookingId/details", requireAuth, uploadCloth.single("clothImage"), async (request, response) => {
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

    // Fetch tailor details from MongoDB JoinApplication
    let tailor = await JoinApplication.findById(tailorApplicationId);

    if (!tailor) {
      // Fallback: Check MongoDB User model where role is tailor
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

    // Update MongoDB
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

app.post("/api/bookings/:bookingId/tailor", requireAuth, async (request, response) => {
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

    // Check if the requested tailorApplicationId matches the authenticated tailor
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
      // Fallback: Check MongoDB User model where role is tailor
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

    // Update MongoDB
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

app.post("/api/join", uploadProfile.single("image"), async (request, response) => {
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

app.get("/api/join", requireAuth, requireAdmin, async (_request, response) => {
  try {
    const applications = await JoinApplication.find().sort({ createdAt: -1 });

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

app.get("/api/tailors", async (request, response) => {
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
      const reviews = await Review.find({ tailorApplicationId: ja._id });
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
        .filter((t) => t.distance !== null)
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

app.get("/api/tailors/:tailorId", async (request, response) => {
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

    const reviews = await Review.find({ tailorApplicationId: tailorId });
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

app.post("/api/payments/create-order", requireAuth, async (request, response) => {
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

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const isRazorpayConfigured = keyId && keyId.trim() && keySecret && keySecret.trim();

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
      const instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const orderData = await instance.orders.create({
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
        key_id: keyId,
        isMock: false,
        key: keyId,
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

app.post("/api/payments/verify", requireAuth, verifyPaymentHandler);
app.post("/api/payments/verify-payment", requireAuth, verifyPaymentHandler);

app.post("/api/payments/activate-free-plan", requireAuth, async (request, response) => {
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

app.patch("/api/bookings/:bookingId/status", requireAuth, async (request, response) => {
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
      // Must be the assigned tailor
      if (!mongoBooking.tailorApplicationId || Number(mongoBooking.tailorApplicationId) !== authenticatedUserId) {
        return response.status(403).json({
          message: "You are not authorized to update this booking status",
        });
      }
      // Tailors cannot set status to pending, pending-price, or pending-payment
      const forbiddenTailorStatuses = ["pending", "pending-price", "pending-payment"];
      if (forbiddenTailorStatuses.includes(status)) {
        return response.status(400).json({
          message: "Tailors cannot set status to pending, pending-price, or pending-payment",
        });
      }
    } else if (userRole === "user") {
      // Must own the booking
      if (Number(mongoBooking.userId) !== authenticatedUserId) {
        return response.status(403).json({
          message: "You can only update your own booking status",
        });
      }
      // Customers can only set status to 'booked' (after payment) or 'cancelled'
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

app.patch("/api/bookings/:bookingId/price", requireAuth, async (request, response) => {
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

app.post("/api/reviews", requireAuth, async (request, response) => {
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

app.post("/api/business-orders", requireAuth, async (request, response) => {
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

app.get("/api/business-orders", requireAuth, async (request, response) => {
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

app.get("/api/business-orders/:orderId", requireAuth, async (request, response) => {
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

app.patch("/api/business-orders/:orderId/price", requireAuth, async (request, response) => {
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

app.patch("/api/business-orders/:orderId/status", requireAuth, async (request, response) => {
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

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Client connected to Socket.IO:", socket.id);

  socket.on("join-booking", (bookingId) => {
    socket.join(`booking-${bookingId}`);
    console.log(`Socket ${socket.id} joined room booking-${bookingId}`);
  });

  socket.on("update-location", (data) => {
    console.log(`Location update for booking ${data.bookingId}:`, data.lat, data.lng);
    io.to(`booking-${data.bookingId}`).emit("location-updated", {
      lat: data.lat,
      lng: data.lng,
      timestamp: Date.now()
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected from Socket.IO:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
