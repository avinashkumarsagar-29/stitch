require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const https = require("https");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { getSqlPool, sql } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const otpExpiryMinutes = 5;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
    const pool = await getSqlPool();
    const result = await pool.request().query("SELECT DB_NAME() AS databaseName");

    response.json({
      status: "ok",
      database: result.recordset[0].databaseName,
    });
  } catch (error) {
    console.error("Database health error:", error);
    response.status(500).json({
      status: "error",
      message: error.originalError?.message || error.message,
    });
  }
});

async function ensureBookingsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Bookings', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Bookings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NULL,
        pickupLocation NVARCHAR(255) NOT NULL,
        dropoffLocation NVARCHAR(255) NOT NULL,
        bookingDate DATE NOT NULL,
        bookingTime TIME NOT NULL,
        tailorApplicationId INT NULL,
        tailorName NVARCHAR(201) NULL,
        tailorEmail NVARCHAR(255) NULL,
        tailorPhoneNumber NVARCHAR(20) NULL,
        clothCategory NVARCHAR(100) NULL,
        clothImage NVARCHAR(MAX) NULL,
        material NVARCHAR(100) NULL,
        approxPrice DECIMAL(10,2) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        trackingCode NVARCHAR(10) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Bookings_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'tailorApplicationId') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD tailorApplicationId INT NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'tailorName') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD tailorName NVARCHAR(201) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'tailorEmail') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD tailorEmail NVARCHAR(255) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'tailorPhoneNumber') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD tailorPhoneNumber NVARCHAR(20) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'clothCategory') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD clothCategory NVARCHAR(100) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'clothImage') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD clothImage NVARCHAR(MAX) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'material') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD material NVARCHAR(100) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'approxPrice') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD approxPrice DECIMAL(10,2) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'trackingCode') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD trackingCode NVARCHAR(10) NULL;
    END
  `);
}

async function ensureJoinTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.JoinApplications', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.JoinApplications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        firstName NVARCHAR(100) NOT NULL,
        lastName NVARCHAR(100) NOT NULL,
        email NVARCHAR(255) NOT NULL DEFAULT '',
        phoneNumber NVARCHAR(20) NOT NULL DEFAULT '',
        experience NVARCHAR(50) NOT NULL,
        location NVARCHAR(255) NOT NULL,
        image NVARCHAR(MAX) NULL,
        [plan] NVARCHAR(50) NOT NULL DEFAULT 'Free',
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.JoinApplications', 'email') IS NULL
    BEGIN
      ALTER TABLE dbo.JoinApplications ADD email NVARCHAR(255) NOT NULL DEFAULT '';
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.JoinApplications', 'phoneNumber') IS NULL
    BEGIN
      ALTER TABLE dbo.JoinApplications ADD phoneNumber NVARCHAR(20) NOT NULL DEFAULT '';
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.JoinApplications', 'plan') IS NULL
    BEGIN
      ALTER TABLE dbo.JoinApplications ADD [plan] NVARCHAR(50) NOT NULL DEFAULT 'Free';
    END
  `);
}

async function ensureMeasurementsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Measurements', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Measurements (
        id INT IDENTITY PRIMARY KEY,
        userId INT NOT NULL,
        chest DECIMAL(5,2),
        waist DECIMAL(5,2),
        hip DECIMAL(5,2),
        shoulder DECIMAL(5,2),
        inseam DECIMAL(5,2),
        updatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Measurements_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
      );
    END
  `);
}

async function ensureAuthTables(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Users', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        fullName NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phoneNumber NVARCHAR(20) NOT NULL UNIQUE,
        passwordHash NVARCHAR(255) NOT NULL DEFAULT '',
        role NVARCHAR(50) NOT NULL DEFAULT 'user',
        [plan] NVARCHAR(50) NOT NULL DEFAULT 'Free',
        firstName NVARCHAR(100) NULL,
        lastName NVARCHAR(100) NULL,
        address NVARCHAR(255) NULL,
        image NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'role') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD role NVARCHAR(50) NOT NULL DEFAULT 'user';
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'plan') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD [plan] NVARCHAR(50) NOT NULL DEFAULT 'Free';
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'firstName') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD firstName NVARCHAR(100) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'lastName') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD lastName NVARCHAR(100) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'address') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD address NVARCHAR(255) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'image') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD image NVARCHAR(MAX) NULL;
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.LoginOtps', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.LoginOtps (
        id INT IDENTITY(1,1) PRIMARY KEY,
        phoneNumber NVARCHAR(20) NOT NULL,
        otpCode NVARCHAR(6) NOT NULL,
        expiresAt DATETIME2 NOT NULL,
        usedAt DATETIME2 NULL,
        attempts INT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.LoginOtps', 'attempts') IS NULL
    BEGIN
      ALTER TABLE dbo.LoginOtps ADD attempts INT NOT NULL DEFAULT 0;
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'UX_Users_phoneNumber'
      AND object_id = OBJECT_ID('dbo.Users')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_Users_phoneNumber
      ON dbo.Users(phoneNumber)
      WHERE phoneNumber IS NOT NULL;
    END
  `);
}

function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d+]/g, "").trim();
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

function authenticateApiRequest(request, response, next) {
  const authHeader = request.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return response.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    request.user = verifyJwt(token);
    return next();
  } catch (error) {
    return response.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

function requireAuth(request, response, next) {
  return authenticateApiRequest(request, response, next);
}

function requireAdmin(request, response, next) {
  if (request.user?.role !== "admin") {
    return response.status(403).json({
      message: "Forbidden: Admin access required",
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
  return getAuthenticatedUserId(request) === Number(userId);
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

    if (!fullName || !email || !phoneNumber || !password) {
      return response.status(400).json({
        message: "Full name, email, phone number and password are required",
      });
    }

    if (!["user", "tailor"].includes(role)) {
      return response.status(400).json({
        message: "Role must be 'user' or 'tailor'",
      });
    }

    if (password.length < 6) {
      return response.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    if (phoneNumber.length < 10) {
      return response.status(400).json({
        message: "Please enter a valid phone number",
      });
    }

    const pool = await getSqlPool();
    await ensureAuthTables(pool);
    const existingUser = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query("SELECT id FROM Users WHERE email = @email OR phoneNumber = @phoneNumber");

    if (existingUser.recordset.length > 0) {
      return response.status(409).json({
        message: "Email or phone number is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool
      .request()
      .input("fullName", sql.NVarChar(150), fullName)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("passwordHash", sql.NVarChar(255), passwordHash)
      .input("role", sql.NVarChar(50), role)
      .query(`
        INSERT INTO Users (fullName, email, phoneNumber, passwordHash, role)
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.[plan]
        VALUES (@fullName, @email, @phoneNumber, @passwordHash, @role)
      `);

    return response.status(201).json({
      message: "Registration successful",
      user: {
        ...result.recordset[0],
        plan: result.recordset[0].plan || "Free"
      },
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
    const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);

    if (!phoneNumber) {
      return response.status(400).json({
        message: "Phone number is required",
      });
    }

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    // Rate Limiting Check: Max 3 OTP requests in the last 10 minutes
    const recentOtpsResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT COUNT(*) AS count
        FROM LoginOtps
        WHERE phoneNumber = @phoneNumber
          AND createdAt > DATEADD(minute, -10, SYSUTCDATETIME())
      `);
    const requestCount = recentOtpsResult.recordset[0].count;

    if (requestCount >= 3) {
      return response.status(429).json({
        message: "Too many OTP requests. Please wait before requesting another OTP.",
      });
    }

    const userResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT id, fullName, email, phoneNumber
        FROM Users
        WHERE phoneNumber = @phoneNumber
      `);

    const user = userResult.recordset[0];

    if (!user) {
      return response.status(404).json({
        message: "Phone number is not registered",
      });
    }

    const otpCode = generateOtp();
    await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("otpCode", sql.NVarChar(6), otpCode)
      .input("expiresAt", sql.DateTime2, new Date(Date.now() + otpExpiryMinutes * 60 * 1000))
      .query(`
        INSERT INTO LoginOtps (phoneNumber, otpCode, expiresAt)
        VALUES (@phoneNumber, @otpCode, @expiresAt)
      `);

    const smsResult = await sendOtpSms(phoneNumber, otpCode);

    return response.json({
      message: smsResult.sent
        ? "OTP sent successfully"
        : "OTP generated successfully. Configure SMS settings to send it to the phone.",
      devOtp: smsResult.sent ? undefined : otpCode,
    });
  } catch (error) {
    console.error("OTP request error:", error);
    return response.status(500).json({
      message: "Unable to send OTP",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.post("/api/auth/verify-otp", async (request, response) => {
  try {
    const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);
    const otpCode = String(request.body.otp || "").trim();

    if (!phoneNumber || !otpCode) {
      return response.status(400).json({
        message: "Phone number and OTP are required",
      });
    }

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    // Retrieve the latest active (unused & unexpired) OTP record for this phone number
    const activeOtpResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT TOP 1 id, otpCode, attempts
        FROM LoginOtps
        WHERE phoneNumber = @phoneNumber
          AND usedAt IS NULL
          AND expiresAt > SYSUTCDATETIME()
        ORDER BY createdAt DESC
      `);
    
    const activeOtp = activeOtpResult.recordset[0];

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
      await pool
        .request()
        .input("id", sql.Int, activeOtp.id)
        .query(`
          UPDATE LoginOtps
          SET attempts = attempts + 1,
              usedAt = CASE WHEN attempts + 1 >= 3 THEN SYSUTCDATETIME() ELSE NULL END
          WHERE id = @id
        `);

      if (activeOtp.attempts + 1 >= 3) {
        return response.status(429).json({
          message: "Too many failed attempts. This OTP has been invalidated. Please request a new OTP.",
        });
      }

      return response.status(401).json({
        message: "Invalid or expired OTP",
      });
    }

    // OTP is correct. Mark it as used.
    await pool
      .request()
      .input("id", sql.Int, activeOtp.id)
      .query("UPDATE LoginOtps SET usedAt = SYSUTCDATETIME() WHERE id = @id");

    const userResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT id, fullName, email, phoneNumber, role, [plan], firstName, lastName, address, image
        FROM Users
        WHERE phoneNumber = @phoneNumber
      `);

    const user = userResult.recordset[0];

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
      },
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    return response.status(500).json({
      message: "Unable to login",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.use("/api", authenticateApiRequest);

app.get("/api/users/:userId/profile", async (request, response) => {
  try {
    const userId = Number(request.params.userId);
    if (!userId) {
      return response.status(400).json({ message: "User ID is required" });
    }

    if (!canAccessUser(request, userId)) {
      return response.status(403).json({ message: "You can only access your own profile" });
    }

    const pool = await getSqlPool();
    await ensureAuthTables(pool);
    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT id, fullName, email, phoneNumber, role, [plan], firstName, lastName, address, image
        FROM Users
        WHERE id = @userId
      `);

    const user = userResult.recordset[0];
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

    const pool = await getSqlPool();
    await ensureMeasurementsTable(pool);

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 1 chest, waist, hip, shoulder, inseam
        FROM Measurements
        WHERE userId = @userId
      `);

    const measurements = result.recordset[0] || null;
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

    if (!userId) {
      return response.status(400).json({ message: "User ID is required" });
    }

    if (!canAccessUser(request, userId)) {
      return response.status(403).json({ message: "You can only update your own measurements" });
    }

    const pool = await getSqlPool();
    await ensureMeasurementsTable(pool);

    // Check if measurements exist
    const checkExist = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT 1 FROM Measurements WHERE userId = @userId");

    if (checkExist.recordset.length > 0) {
      // Update
      await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("chest", sql.Decimal(5, 2), chest)
        .input("waist", sql.Decimal(5, 2), waist)
        .input("hip", sql.Decimal(5, 2), hip)
        .input("shoulder", sql.Decimal(5, 2), shoulder)
        .input("inseam", sql.Decimal(5, 2), inseam)
        .query(`
          UPDATE Measurements
          SET chest = @chest, waist = @waist, hip = @hip, shoulder = @shoulder, inseam = @inseam, updatedAt = SYSUTCDATETIME()
          WHERE userId = @userId
        `);
    } else {
      // Insert
      await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("chest", sql.Decimal(5, 2), chest)
        .input("waist", sql.Decimal(5, 2), waist)
        .input("hip", sql.Decimal(5, 2), hip)
        .input("shoulder", sql.Decimal(5, 2), shoulder)
        .input("inseam", sql.Decimal(5, 2), inseam)
        .query(`
          INSERT INTO Measurements (userId, chest, waist, hip, shoulder, inseam)
          VALUES (@userId, @chest, @waist, @hip, @shoulder, @inseam)
        `);
    }

    return response.json({
      message: "Measurements saved successfully",
      measurements: { chest, waist, hip, shoulder, inseam }
    });
  } catch (error) {
    console.error("Save measurements error:", error);
    return response.status(500).json({
      message: "Unable to save measurements",
      detail: error.message,
    });
  }
});

app.put("/api/users/:userId/profile", async (request, response) => {
  try {
    const userId = Number(request.params.userId);
    let fullName = String(request.body.fullName || "").trim();
    let firstName = String(request.body.firstName || "").trim();
    let lastName = String(request.body.lastName || "").trim();
    const email = String(request.body.email || "").trim().toLowerCase();
    const phone = normalizePhoneNumber(request.body.phone);
    const address = String(request.body.address || "").trim();
    const image = request.body.image || null;

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

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    // Fetch user role first
    const roleResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT role, email, phoneNumber FROM Users WHERE id = @userId");

    const user = roleResult.recordset[0];
    if (!user) {
      return response.status(404).json({ message: "User not found" });
    }

    const oldEmail = user.email;
    const oldPhone = user.phoneNumber;

    // Check if new email or phone is already used by another user
    const checkDuplicate = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phone)
      .query(`
        SELECT id FROM Users 
        WHERE (email = @email OR phoneNumber = @phoneNumber)
          AND id <> @userId
      `);

    if (checkDuplicate.recordset.length > 0) {
      return response.status(409).json({
        message: "Email or phone number is already registered by another account",
      });
    }

    // Update Users table
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("fullName", sql.NVarChar(150), fullName)
      .input("firstName", sql.NVarChar(100), firstName)
      .input("lastName", sql.NVarChar(100), lastName)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phone)
      .input("address", sql.NVarChar(255), address)
      .input("image", sql.NVarChar(sql.MAX), image)
      .query(`
        UPDATE Users
        SET 
          fullName = @fullName,
          firstName = @firstName,
          lastName = @lastName,
          email = @email,
          phoneNumber = @phoneNumber,
          address = @address,
          image = @image
        OUTPUT 
          INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.[plan],
          INSERTED.firstName, INSERTED.lastName, INSERTED.address, INSERTED.image
        WHERE id = @userId
      `);

    const updatedUser = result.recordset[0];

    // If user is a tailor, synchronize their profile information to JoinApplications
    if (user.role === "tailor") {
      await ensureJoinTable(pool);
      await pool
        .request()
        .input("firstName", sql.NVarChar(100), firstName)
        .input("lastName", sql.NVarChar(100), lastName)
        .input("email", sql.NVarChar(255), email)
        .input("phoneNumber", sql.NVarChar(20), phone)
        .input("address", sql.NVarChar(255), address)
        .input("oldEmail", sql.NVarChar(255), oldEmail)
        .input("oldPhone", sql.NVarChar(20), oldPhone)
        .query(`
          UPDATE JoinApplications
          SET 
            firstName = @firstName,
            lastName = @lastName,
            email = @email,
            phoneNumber = @phoneNumber,
            location = @address
          WHERE email = @oldEmail OR phoneNumber = @oldPhone
        `);
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

app.post("/api/bookings", async (request, response) => {
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("pickupLocation", sql.NVarChar(255), pickupLocation)
      .input("dropoffLocation", sql.NVarChar(255), dropoffLocation)
      .input("bookingDate", sql.Date, bookingDate)
      .input("bookingTime", sql.VarChar(8), bookingTime)
      .query(`
        INSERT INTO Bookings (
          userId,
          pickupLocation,
          dropoffLocation,
          bookingDate,
          bookingTime
        )
        OUTPUT
          INSERTED.id,
          INSERTED.userId,
          INSERTED.pickupLocation,
          INSERTED.dropoffLocation,
          INSERTED.bookingDate,
          INSERTED.bookingTime,
          INSERTED.tailorApplicationId,
          INSERTED.tailorName,
          INSERTED.tailorEmail,
          INSERTED.tailorPhoneNumber,
          INSERTED.clothCategory,
          INSERTED.clothImage,
          INSERTED.material,
          INSERTED.approxPrice,
          INSERTED.status,
          INSERTED.trackingCode,
          INSERTED.createdAt
        VALUES (
          @userId,
          @pickupLocation,
          @dropoffLocation,
          @bookingDate,
          CONVERT(time, @bookingTime)
        )
      `);

    return response.status(201).json({
      message: "Booking saved successfully",
      booking: result.recordset[0],
    });
  } catch (error) {
    console.error("Booking create error:", error);
    return response.status(500).json({
      message: "Unable to save booking",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/bookings", async (request, response) => {
  try {
    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    await ensureMeasurementsTable(pool);

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    if (userRole === "user") {
      await pool
        .request()
        .input("userId", sql.Int, authenticatedUserId)
        .query(`
          DELETE FROM Bookings
          WHERE userId = @userId
            AND status IN ('delivered', 'out-for-delivery')
            AND createdAt < DATEADD(hour, -24, SYSUTCDATETIME())
        `);
    }

    let result;
    if (userRole === "tailor") {
      const tailorEmail = request.user?.email || "";
      const tailorPhoneNumber = request.user?.phoneNumber || "";

      result = await pool
        .request()
        .input("tailorId", sql.Int, authenticatedUserId)
        .input("tailorEmail", sql.NVarChar(255), tailorEmail)
        .input("tailorPhoneNumber", sql.NVarChar(20), tailorPhoneNumber)
        .query(`
          SELECT
            b.id,
            b.userId,
            u.fullName,
            u.email,
            b.pickupLocation,
            b.dropoffLocation,
            b.bookingDate,
            b.bookingTime,
            b.tailorApplicationId,
            b.tailorName,
            b.tailorEmail,
            b.tailorPhoneNumber,
            b.clothCategory,
            b.clothImage,
            b.material,
            b.approxPrice,
            b.status,
            b.trackingCode,
            b.createdAt,
            m.chest,
            m.waist,
            m.hip,
            m.shoulder,
            m.inseam
          FROM Bookings b
          LEFT JOIN Users u ON u.id = b.userId
          LEFT JOIN Measurements m ON m.userId = b.userId
          WHERE b.tailorApplicationId = @tailorId
             OR (b.tailorEmail IS NOT NULL AND LOWER(TRIM(b.tailorEmail)) = LOWER(TRIM(@tailorEmail)))
             OR (b.tailorPhoneNumber IS NOT NULL AND TRIM(b.tailorPhoneNumber) = TRIM(@tailorPhoneNumber))
             OR (b.tailorApplicationId IS NULL AND b.tailorEmail IS NULL AND b.status = 'pending-price')
          ORDER BY b.createdAt DESC
        `);
    } else if (userRole === "user") {
      result = await pool
        .request()
        .input("userId", sql.Int, authenticatedUserId)
        .query(`
          SELECT
            b.id,
            b.userId,
            u.fullName,
            u.email,
            b.pickupLocation,
            b.dropoffLocation,
            b.bookingDate,
            b.bookingTime,
            b.tailorApplicationId,
            b.tailorName,
            b.tailorEmail,
            b.tailorPhoneNumber,
            b.clothCategory,
            b.clothImage,
            b.material,
            b.approxPrice,
            b.status,
            b.trackingCode,
            b.createdAt,
            m.chest,
            m.waist,
            m.hip,
            m.shoulder,
            m.inseam
          FROM Bookings b
          LEFT JOIN Users u ON u.id = b.userId
          LEFT JOIN Measurements m ON m.userId = b.userId
          WHERE b.userId = @userId
          ORDER BY b.createdAt DESC
        `);
    } else {
      return response.status(403).json({
        message: "Unauthorized role",
      });
    }

    return response.json({
      bookings: result.recordset,
    });
  } catch (error) {
    console.error("Booking list error:", error);
    return response.status(500).json({
      message: "Unable to load bookings",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/bookings/:bookingId", async (request, response) => {
  try {
    const bookingIdParam = String(request.params.bookingId || "").trim();
    const bookingIdNum = Number(bookingIdParam) || 0;

    if (!bookingIdParam) {
      return response.status(400).json({
        message: "Booking id or tracking code is required",
      });
    }

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    await ensureMeasurementsTable(pool);

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    if (userRole === "user") {
      await pool
        .request()
        .input("userId", sql.Int, authenticatedUserId)
        .query(`
          DELETE FROM Bookings
          WHERE userId = @userId
            AND status IN ('delivered', 'out-for-delivery')
            AND createdAt < DATEADD(hour, -24, SYSUTCDATETIME())
        `);
    }
    const result = await pool
      .request()
      .input("bookingIdNum", sql.Int, bookingIdNum)
      .input("bookingIdStr", sql.NVarChar(255), bookingIdParam)
      .query(`
        SELECT TOP 1
          b.id,
          b.userId,
          u.fullName,
          u.email,
          b.pickupLocation,
          b.dropoffLocation,
          b.bookingDate,
          b.bookingTime,
          b.tailorApplicationId,
          b.tailorName,
          b.tailorEmail,
          b.tailorPhoneNumber,
          b.clothCategory,
          b.clothImage,
          b.material,
          b.approxPrice,
          b.status,
          b.trackingCode,
          b.createdAt,
          m.chest,
          m.waist,
          m.hip,
          m.shoulder,
          m.inseam
        FROM Bookings b
        LEFT JOIN Users u ON u.id = b.userId
        LEFT JOIN Measurements m ON m.userId = b.userId
        WHERE b.id = @bookingIdNum OR b.trackingCode = @bookingIdStr
      `);
    const booking = result.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    if (!isAuthenticatedTailor(request) && Number(booking.userId) !== getAuthenticatedUserId(request)) {
      return response.status(403).json({
        message: "You can only access your own bookings",
      });
    }

    return response.json({ booking });
  } catch (error) {
    console.error("Booking detail error:", error);
    return response.status(500).json({
      message: "Unable to load booking",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.post("/api/bookings/:bookingId/details", async (request, response) => {
  try {
    const bookingId = Number(request.params.bookingId);
    const tailorApplicationId = Number(request.body.tailorApplicationId);
    const clothCategory = String(request.body.clothCategory || "").trim();
    const material = String(request.body.material || "").trim();
    const approxPrice = request.body.approxPrice !== undefined && request.body.approxPrice !== null ? Number(request.body.approxPrice) : null;
    const clothImage = request.body.clothImage || null;

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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    await ensureJoinTable(pool);

    const checkBooking = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .query(`
        SELECT TOP 1
          b.id,
          b.userId,
          b.trackingCode,
          u.email AS userEmail,
          u.fullName AS userFullName
        FROM Bookings b
        LEFT JOIN Users u ON u.id = b.userId
        WHERE b.id = @bookingId
      `);

    const existingBooking = checkBooking.recordset[0];
    if (!existingBooking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    if (userRole === "user") {
      if (Number(existingBooking.userId) !== authenticatedUserId) {
        return response.status(403).json({
          message: "You can only update details for your own bookings",
        });
      }
    } else if (userRole === "tailor") {
      const tailorEmail = request.user?.email || "";
      const tailorPhoneNumber = request.user?.phoneNumber || "";
      const isAssigned = (
        (existingBooking.tailorApplicationId && Number(existingBooking.tailorApplicationId) === authenticatedUserId) ||
        (existingBooking.tailorEmail && existingBooking.tailorEmail.toLowerCase().trim() === tailorEmail.toLowerCase().trim()) ||
        (existingBooking.tailorPhoneNumber && existingBooking.tailorPhoneNumber.trim() === tailorPhoneNumber.trim()) ||
        (!existingBooking.tailorApplicationId && !existingBooking.tailorEmail)
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

    const trackingCode = existingBooking.trackingCode || String(Math.floor(1000000 + Math.random() * 9000000));
    const userEmail = existingBooking.userEmail || "";

    let tailorResult = await pool
      .request()
      .input("tailorApplicationId", sql.Int, tailorApplicationId)
      .query(`
        SELECT TOP 1
          id,
          firstName,
          lastName,
          email,
          phoneNumber
        FROM JoinApplications
        WHERE id = @tailorApplicationId
      `);
    let tailor = tailorResult.recordset[0];

    if (!tailor) {
      // Fallback: Check Users table where role is tailor
      const userResult = await pool
        .request()
        .input("userId", sql.Int, tailorApplicationId)
        .query(`
          SELECT TOP 1
            id,
            firstName,
            lastName,
            fullName,
            email,
            phoneNumber
          FROM Users
          WHERE id = @userId AND role = 'tailor'
        `);
      const userTailor = userResult.recordset[0];
      if (userTailor) {
        tailor = {
          id: userTailor.id,
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

    const bookingResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .input("clothCategory", sql.NVarChar(100), clothCategory)
      .input("clothImage", sql.NVarChar(sql.MAX), clothImage)
      .input("material", sql.NVarChar(100), material)
      .input("approxPrice", sql.Decimal(10, 2), approxPrice)
      .input("trackingCode", sql.NVarChar(10), trackingCode)
      .input("tailorApplicationId", sql.Int, tailor.id)
      .input("tailorName", sql.NVarChar(201), tailorName)
      .input("tailorEmail", sql.NVarChar(255), tailor.email)
      .input("tailorPhoneNumber", sql.NVarChar(20), tailor.phoneNumber)
      .input("status", sql.NVarChar(50), status)
      .query(`
        UPDATE Bookings
        SET
          clothCategory = @clothCategory,
          clothImage = @clothImage,
          material = @material,
          approxPrice = @approxPrice,
          trackingCode = @trackingCode,
          tailorApplicationId = @tailorApplicationId,
          tailorName = @tailorName,
          tailorEmail = @tailorEmail,
          tailorPhoneNumber = @tailorPhoneNumber,
          status = @status
        OUTPUT
          INSERTED.id,
          INSERTED.userId,
          INSERTED.pickupLocation,
          INSERTED.dropoffLocation,
          INSERTED.bookingDate,
          INSERTED.bookingTime,
          INSERTED.tailorApplicationId,
          INSERTED.tailorName,
          INSERTED.tailorEmail,
          INSERTED.tailorPhoneNumber,
          INSERTED.clothCategory,
          INSERTED.clothImage,
          INSERTED.material,
          INSERTED.approxPrice,
          INSERTED.status,
          INSERTED.trackingCode,
          INSERTED.createdAt
        WHERE id = @bookingId
      `);
    const booking = bookingResult.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    // Send email confirmation in background if price is quoted/confirmed
    if (userEmail && approxPrice !== null) {
      sendBookingEmail(userEmail, booking).catch((err) => {
        console.error("Failed to send booking email:", err);
      });
    } else {
      console.log(`Booking #${bookingId} has no registered user email associated or price not set. Email notification skipped.`);
    }

    return response.json({
      message: "Order details saved successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking details error:", error);
    return response.status(500).json({
      message: "Unable to save order details",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.post("/api/bookings/:bookingId/tailor", async (request, response) => {
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    await ensureJoinTable(pool);

    const authenticatedUserId = getAuthenticatedUserId(request);
    const tailorEmail = request.user?.email || "";
    const tailorPhoneNumber = request.user?.phoneNumber || "";

    // Check if the requested tailorApplicationId matches the authenticated tailor
    let isMatch = (tailorApplicationId === authenticatedUserId);

    if (!isMatch) {
      const checkMatchResult = await pool
        .request()
        .input("tailorApplicationId", sql.Int, tailorApplicationId)
        .input("email", sql.NVarChar(255), tailorEmail)
        .input("phone", sql.NVarChar(20), tailorPhoneNumber)
        .query(`
          SELECT 1 FROM JoinApplications
          WHERE id = @tailorApplicationId
            AND (LOWER(TRIM(email)) = LOWER(TRIM(@email)) OR TRIM(phoneNumber) = TRIM(@phone))
        `);
      if (checkMatchResult.recordset.length > 0) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return response.status(403).json({
        message: "You can only accept bookings for your own tailor account",
      });
    }

    let tailorResult = await pool
      .request()
      .input("tailorApplicationId", sql.Int, tailorApplicationId)
      .query(`
        SELECT TOP 1
          id,
          firstName,
          lastName,
          email,
          phoneNumber
        FROM JoinApplications
        WHERE id = @tailorApplicationId
      `);
    let tailor = tailorResult.recordset[0];

    if (!tailor) {
      // Fallback: Check Users table where role is tailor
      const userResult = await pool
        .request()
        .input("userId", sql.Int, tailorApplicationId)
        .query(`
          SELECT TOP 1
            id,
            firstName,
            lastName,
            fullName,
            email,
            phoneNumber
          FROM Users
          WHERE id = @userId AND role = 'tailor'
        `);
      const userTailor = userResult.recordset[0];
      if (userTailor) {
        tailor = {
          id: userTailor.id,
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
    const bookingResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .input("tailorApplicationId", sql.Int, tailor.id)
      .input("tailorName", sql.NVarChar(201), tailorName)
      .input("tailorEmail", sql.NVarChar(255), tailor.email)
      .input("tailorPhoneNumber", sql.NVarChar(20), tailor.phoneNumber)
      .query(`
        UPDATE Bookings
        SET
          tailorApplicationId = @tailorApplicationId,
          tailorName = @tailorName,
          tailorEmail = @tailorEmail,
          tailorPhoneNumber = @tailorPhoneNumber,
          status = 'booked'
        OUTPUT
          INSERTED.id,
          INSERTED.userId,
          INSERTED.pickupLocation,
          INSERTED.dropoffLocation,
          INSERTED.bookingDate,
          INSERTED.bookingTime,
          INSERTED.tailorApplicationId,
          INSERTED.tailorName,
          INSERTED.tailorEmail,
          INSERTED.tailorPhoneNumber,
          INSERTED.clothCategory,
          INSERTED.clothImage,
          INSERTED.material,
          INSERTED.approxPrice,
          INSERTED.status,
          INSERTED.trackingCode,
          INSERTED.createdAt
        WHERE id = @bookingId
      `);
    const booking = bookingResult.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    return response.json({
      message: "Tailor booked successfully",
      booking,
    });
  } catch (error) {
    console.error("Tailor booking error:", error);
    return response.status(500).json({
      message: "Unable to book tailor",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.post("/api/join", async (request, response) => {
  try {
    const firstName = String(request.body.firstName || "").trim();
    const lastName = String(request.body.lastName || "").trim();
    const email = String(request.body.email || "").trim().toLowerCase();
    const phoneNumber = normalizePhoneNumber(request.body.phoneNumber);
    const experience = String(request.body.experience || "").trim();
    const location = String(request.body.location || "").trim();
    const image = request.body.image || null;
    const plan = String(request.body.plan || "Free").trim();

    if (!firstName || !lastName || !email || !phoneNumber || !experience || !location) {
      return response.status(400).json({
        message: "First name, last name, email, phone number, experience, and location are required",
      });
    }

    const pool = await getSqlPool();
    await ensureJoinTable(pool);

    const result = await pool
      .request()
      .input("firstName", sql.NVarChar(100), firstName)
      .input("lastName", sql.NVarChar(100), lastName)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("experience", sql.NVarChar(50), experience)
      .input("location", sql.NVarChar(255), location)
      .input("image", sql.NVarChar(sql.MAX), image)
      .input("plan", sql.NVarChar(50), plan)
      .query(`
        INSERT INTO JoinApplications (
          firstName,
          lastName,
          email,
          phoneNumber,
          experience,
          location,
          image,
          [plan]
        )
        OUTPUT
          INSERTED.id,
          INSERTED.firstName,
          INSERTED.lastName,
          INSERTED.email,
          INSERTED.phoneNumber,
          INSERTED.experience,
          INSERTED.location,
          INSERTED.[plan],
          INSERTED.status,
          INSERTED.createdAt
        VALUES (
          @firstName,
          @lastName,
          @email,
          @phoneNumber,
          @experience,
          @location,
          @image,
          @plan
        )
      `);

    const application = result.recordset[0];

    // Auto-update User profile if a matching user is registered (by email or phone)
    let updatedUserObj = null;
    let updatedProfileObj = null;

    const userCheck = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT id FROM Users 
        WHERE email = @email OR phoneNumber = @phoneNumber
      `);

    if (userCheck.recordset.length > 0) {
      const matchUserId = userCheck.recordset[0].id;
      const fullName = `${firstName} ${lastName}`.trim();

      const userUpdateResult = await pool
        .request()
        .input("userId", sql.Int, matchUserId)
        .input("fullName", sql.NVarChar(150), fullName)
        .input("firstName", sql.NVarChar(100), firstName)
        .input("lastName", sql.NVarChar(100), lastName)
        .input("address", sql.NVarChar(255), location)
        .input("image", sql.NVarChar(sql.MAX), image)
        .query(`
          UPDATE Users
          SET 
            fullName = @fullName,
            firstName = @firstName,
            lastName = @lastName,
            address = @address,
            image = @image,
            role = 'tailor'
          OUTPUT 
            INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.[plan],
            INSERTED.firstName, INSERTED.lastName, INSERTED.address, INSERTED.image
          WHERE id = @userId
        `);

      const updatedUser = userUpdateResult.recordset[0];
      updatedUserObj = {
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
      };

      updatedProfileObj = {
        fullName: updatedUser.fullName,
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.email,
        phone: updatedUser.phoneNumber,
        address: updatedUser.address || "",
        image: updatedUser.image || "",
        role: updatedUser.role,
        plan: updatedUser.plan || "Free",
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
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/join", requireAuth, requireAdmin, async (_request, response) => {
  try {
    const pool = await getSqlPool();
    await ensureJoinTable(pool);
    const result = await pool.request().query(`
      SELECT
        id,
        firstName,
        lastName,
        email,
        phoneNumber,
        experience,
        location,
        image,
        [plan],
        status,
        createdAt
      FROM JoinApplications
      ORDER BY createdAt DESC
    `);

    return response.json({
      applications: result.recordset,
    });
  } catch (error) {
    console.error("Join list error:", error);
    return response.status(500).json({
      message: "Unable to load applications",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/tailors", async (request, response) => {
  try {
    const location = String(request.query.location || "").trim().toLowerCase();

    if (!location) {
      return response.status(400).json({
        message: "Pickup location is required",
      });
    }

    const pool = await getSqlPool();
    await ensureJoinTable(pool);
    const result = await pool.request().query(`
      SELECT
        id,
        firstName,
        lastName,
        email,
        phoneNumber,
        experience,
        location,
        image,
        [plan],
        status,
        createdAt
      FROM JoinApplications
      WHERE status = 'pending'
      ORDER BY createdAt DESC
    `);
    const searchWords = location
      .split(/[\s,.-]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3);
    const planWeights = {
      'Pro': 3,
      'Plus': 2,
      'Free': 1
    };
    const tailors = result.recordset
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
        plan: tailor.plan || "Free",
      }))
      .sort((a, b) => {
        const weightA = planWeights[a.plan] || 1;
        const weightB = planWeights[b.plan] || 1;
        return weightB - weightA;
      });

    return response.json({
      tailors,
    });
  } catch (error) {
    console.error("Tailor search error:", error);
    return response.status(500).json({
      message: "Unable to search tailors",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
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

    const pool = await getSqlPool();
    await ensureJoinTable(pool);
    const result = await pool
      .request()
      .input("tailorId", sql.Int, tailorId)
      .query(`
        SELECT TOP 1
          id,
          firstName,
          lastName,
          email,
          phoneNumber,
          experience,
          location,
          image,
          [plan],
          status,
          createdAt
        FROM JoinApplications
        WHERE id = @tailorId
      `);
    let tailor = result.recordset[0];

    if (!tailor) {
      // Fallback: Check Users table where role is tailor
      const userResult = await pool
        .request()
        .input("userId", sql.Int, tailorId)
        .query(`
          SELECT TOP 1
            id,
            firstName,
            lastName,
            fullName,
            email,
            phoneNumber,
            address,
            image,
            [plan]
          FROM Users
          WHERE id = @userId AND role = 'tailor'
        `);
      const userTailor = userResult.recordset[0];
      if (userTailor) {
        tailor = {
          id: userTailor.id,
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
      },
    });
  } catch (error) {
    console.error("Tailor detail error:", error);
    return response.status(500).json({
      message: "Unable to load tailor",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.post("/api/payments/create-order", async (request, response) => {
  try {
    const planId = String(request.body.planId || "").trim();
    const price = Number(request.body.price);
    const userId = Number(request.body.userId);
    const billingCycle = String(request.body.billingCycle || "monthly").trim();

    if (!planId || !Number.isFinite(price) || price <= 0 || !userId) {
      return response.status(400).json({
        message: "Plan ID, price, and User ID are required",
      });
    }

    if (!canAccessUser(request, userId)) {
      return response.status(403).json({
        message: "You can only create payment orders for your own account",
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const isRazorpayConfigured = keyId && keyId.trim() && keySecret && keySecret.trim();

    if (!isRazorpayConfigured) {
      // Return a Mock Order for developer testing
      return response.json({
        id: "order_mock_" + Math.random().toString(36).substring(2, 11),
        amount: Math.round(price * 100),
        currency: "INR",
        isMock: true,
        key: "rzp_test_mockkey",
        planId,
        billingCycle,
      });
    }

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({
        amount: Math.round(price * 100),
        currency: "INR",
        receipt: "receipt_order_" + Date.now()
      })
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      return response.status(orderRes.status).json({
        message: orderData.error?.description || "Failed to create Razorpay order",
        detail: orderData.error,
      });
    }

    return response.json({
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      isMock: false,
      key: keyId,
      planId,
      billingCycle,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return response.status(500).json({
      message: "Unable to create payment order",
      detail: error.message,
    });
  }
});

app.post("/api/payments/verify-payment", async (request, response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      userId,
      isMock,
    } = request.body;

    if (!planId || !userId) {
      return response.status(400).json({
        message: "Plan ID and User ID are required",
      });
    }

    if (!canAccessUser(request, userId)) {
      return response.status(403).json({
        message: "You can only verify payments for your own account",
      });
    }

    const pool = await getSqlPool();

    if (isMock) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      if (keyId && keyId.trim()) {
        return response.status(400).json({
          message: "Mock payments are disabled because real Razorpay keys are configured",
        });
      }

      if (!planId.startsWith("booking_")) {
        // Update plan in Users table
        await pool
          .request()
          .input("plan", sql.NVarChar(50), planId)
          .input("userId", sql.Int, userId)
          .query("UPDATE Users SET [plan] = @plan WHERE id = @userId");

        // Sync user subscription details to JoinApplications if they are a Tailor
        const userResult = await pool
          .request()
          .input("userId", sql.Int, userId)
          .query("SELECT email, phoneNumber, role FROM Users WHERE id = @userId");
        const user = userResult.recordset[0];

        if (user && user.role === "tailor") {
          await pool
            .request()
            .input("plan", sql.NVarChar(50), planId)
            .input("email", sql.NVarChar(255), user.email)
            .input("phoneNumber", sql.NVarChar(20), user.phoneNumber)
            .query(`
              UPDATE JoinApplications
              SET [plan] = @plan
              WHERE email = @email OR phoneNumber = @phoneNumber
            `);
        }
      }

      return response.json({
        success: true,
        message: planId.startsWith("booking_") ? "Mock payment verified and booking confirmed" : "Mock payment verified and subscription activated",
        plan: planId,
      });
    }

    // Real signature verification using crypto
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return response.status(500).json({
        message: "Razorpay keys are not configured on the server",
      });
    }

    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      return response.status(400).json({
        message: "Invalid payment signature. Payment verification failed.",
      });
    }

    if (!planId.startsWith("booking_")) {
      // Signature matches, update plan in Users table
      await pool
        .request()
        .input("plan", sql.NVarChar(50), planId)
        .input("userId", sql.Int, userId)
        .query("UPDATE Users SET [plan] = @plan WHERE id = @userId");

      // Sync to JoinApplications if tailor
      const userResult = await pool
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT email, phoneNumber, role FROM Users WHERE id = @userId");
      const user = userResult.recordset[0];

      if (user && user.role === "tailor") {
        await pool
          .request()
          .input("plan", sql.NVarChar(50), planId)
          .input("email", sql.NVarChar(255), user.email)
          .input("phoneNumber", sql.NVarChar(20), user.phoneNumber)
          .query(`
            UPDATE JoinApplications
            SET [plan] = @plan
            WHERE email = @email OR phoneNumber = @phoneNumber
          `);
      }
    }

    return response.json({
      success: true,
      message: planId.startsWith("booking_") ? "Payment verified and booking confirmed successfully" : "Payment verified and subscription activated successfully",
      plan: planId,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return response.status(500).json({
      message: "Unable to verify payment signature",
      detail: error.message,
    });
  }
});

app.post("/api/payments/activate-free-plan", async (request, response) => {
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
    const pool = await getSqlPool();

    // Update plan in Users table
    await pool
      .request()
      .input("plan", sql.NVarChar(50), planToActivate)
      .input("userId", sql.Int, userId)
      .query("UPDATE Users SET [plan] = @plan WHERE id = @userId");

    // Sync to JoinApplications if tailor
    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT email, phoneNumber, role FROM Users WHERE id = @userId");
    const user = userResult.recordset[0];

    if (user && user.role === "tailor") {
      await pool
        .request()
        .input("plan", sql.NVarChar(50), planToActivate)
        .input("email", sql.NVarChar(255), user.email)
        .input("phoneNumber", sql.NVarChar(20), user.phoneNumber)
        .query(`
          UPDATE JoinApplications
          SET [plan] = @plan
          WHERE email = @email OR phoneNumber = @phoneNumber
        `);
    }

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

app.patch("/api/bookings/:bookingId/status", async (request, response) => {
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);

    const accessResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .query("SELECT TOP 1 userId, tailorApplicationId, status FROM Bookings WHERE id = @bookingId");
    const existingBooking = accessResult.recordset[0];

    if (!existingBooking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    if (userRole === "tailor") {
      // Must be the assigned tailor
      if (!existingBooking.tailorApplicationId || Number(existingBooking.tailorApplicationId) !== authenticatedUserId) {
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
      if (Number(existingBooking.userId) !== authenticatedUserId) {
        return response.status(403).json({
          message: "You can only update your own booking status",
        });
      }
      // Customers can only set status to 'booked' (after payment) or 'cancelled'
      if (status === "booked") {
        if (existingBooking.status !== "pending-payment") {
          return response.status(400).json({
            message: "Cannot mark booking as booked unless it is pending payment",
          });
        }
      } else if (status === "cancelled") {
        const cancellableStatuses = ["pending", "pending-price", "pending-payment"];
        if (!cancellableStatuses.includes(existingBooking.status)) {
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

    const result = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .input("status", sql.NVarChar(50), status)
      .query(`
        UPDATE Bookings
        SET [status] = @status
        OUTPUT
          INSERTED.id,
          INSERTED.status,
          INSERTED.trackingCode
        WHERE id = @bookingId
      `);

    const booking = result.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    return response.json({
      message: "Booking status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking status update error:", error);
    return response.status(500).json({
      message: "Unable to update booking status",
      detail: error.message,
    });
  }
});

app.patch("/api/bookings/:bookingId/price", async (request, response) => {
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);

    let tailor = null;
    if (tailorApplicationId) {
      const tailorId = Number(tailorApplicationId);
      let tailorResult = await pool
        .request()
        .input("tailorApplicationId", sql.Int, tailorId)
        .query(`
          SELECT TOP 1
            id,
            firstName,
            lastName,
            email,
            phoneNumber
          FROM JoinApplications
          WHERE id = @tailorApplicationId
        `);
      tailor = tailorResult.recordset[0];

      if (!tailor) {
        // Fallback: Check Users table where role is tailor
        const userResult = await pool
          .request()
          .input("userId", sql.Int, tailorId)
          .query(`
            SELECT TOP 1
              id,
              firstName,
              lastName,
              fullName,
              email,
              phoneNumber
            FROM Users
            WHERE id = @userId AND role = 'tailor'
          `);
        const userTailor = userResult.recordset[0];
        if (userTailor) {
          tailor = {
            id: userTailor.id,
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

    let result;
    if (tailor) {
      const tailorName = `${tailor.firstName} ${tailor.lastName}`.trim();
      result = await pool
        .request()
        .input("bookingId", sql.Int, bookingId)
        .input("approxPrice", sql.Decimal(10, 2), priceNum)
        .input("tailorApplicationId", sql.Int, tailor.id)
        .input("tailorName", sql.NVarChar(201), tailorName)
        .input("tailorEmail", sql.NVarChar(255), tailor.email)
        .input("tailorPhoneNumber", sql.NVarChar(20), tailor.phoneNumber)
        .query(`
          UPDATE Bookings
          SET 
            approxPrice = @approxPrice,
            status = 'pending-payment',
            tailorApplicationId = @tailorApplicationId,
            tailorName = @tailorName,
            tailorEmail = @tailorEmail,
            tailorPhoneNumber = @tailorPhoneNumber
          OUTPUT
            INSERTED.id,
            INSERTED.approxPrice,
            INSERTED.status,
            INSERTED.trackingCode
          WHERE id = @bookingId
        `);
    } else {
      result = await pool
        .request()
        .input("bookingId", sql.Int, bookingId)
        .input("approxPrice", sql.Decimal(10, 2), priceNum)
        .query(`
          UPDATE Bookings
          SET 
            approxPrice = @approxPrice,
            status = 'pending-payment'
          OUTPUT
            INSERTED.id,
            INSERTED.approxPrice,
            INSERTED.status,
            INSERTED.trackingCode
          WHERE id = @bookingId
        `);
    }

    const booking = result.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
      });
    }

    // Retrieve booking with user email details
    const bookingQuery = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .query(`
        SELECT 
          b.*,
          u.email AS userEmail,
          u.fullName AS userFullName
        FROM Bookings b
        LEFT JOIN Users u ON b.userId = u.id
        WHERE b.id = @bookingId
      `);
    const bookingDetails = bookingQuery.recordset[0];

    if (bookingDetails && bookingDetails.userEmail) {
      sendPriceQuoteEmail(bookingDetails.userEmail, bookingDetails).catch((err) => {
        console.error("Failed to send price quote email:", err);
      });
    }

    return response.json({
      message: "Booking price updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking price update error:", error);
    return response.status(500).json({
      message: "Unable to update booking price",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
