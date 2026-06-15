require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const https = require("https");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
// Database connection helper
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

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'referralDiscount') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD referralDiscount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Bookings', 'creditApplied') IS NULL
    BEGIN
      ALTER TABLE dbo.Bookings ADD creditApplied DECIMAL(10,2) NOT NULL DEFAULT 0.00;
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
        rejectionReason NVARCHAR(500) NULL,
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

  await pool.request().query(`
    IF COL_LENGTH('dbo.JoinApplications', 'rejectionReason') IS NULL
    BEGIN
      ALTER TABLE dbo.JoinApplications ADD rejectionReason NVARCHAR(500) NULL;
    END
  `);
}

async function ensurePaymentsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Payments', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        planPurchased NVARCHAR(100) NOT NULL,
        razorpayOrderId NVARCHAR(100) NULL,
        razorpayPaymentId NVARCHAR(100) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Payments_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
      );
    END
  `);

  // Seed some mock payments if empty
  const countRes = await pool.request().query("SELECT COUNT(*) AS cnt FROM dbo.Payments");
  if (countRes.recordset[0].cnt === 0) {
    const usersRes = await pool.request().query("SELECT TOP 5 id FROM dbo.Users");
    const userIds = usersRes.recordset.map(r => r.id);
    if (userIds.length > 0) {
      const u1 = userIds[0];
      const u2 = userIds[1] || u1;
      const u3 = userIds[2] || u1;

      await pool.request()
        .input("u1", sql.Int, u1)
        .input("u2", sql.Int, u2)
        .input("u3", sql.Int, u3)
        .query(`
          INSERT INTO dbo.Payments (userId, amount, planPurchased, razorpayOrderId, razorpayPaymentId, status, createdAt)
          VALUES 
            (@u1, 999.00, 'Pro', 'order_mock_pro1', 'pay_mock_pro1', 'verified', DATEADD(day, -5, SYSUTCDATETIME())),
            (@u2, 299.00, 'Plus', 'order_mock_plus1', 'pay_mock_plus1', 'verified', DATEADD(day, -3, SYSUTCDATETIME())),
            (@u3, 499.00, 'booking_1', 'order_mock_book1', 'pay_mock_book1', 'verified', DATEADD(day, -1, SYSUTCDATETIME())),
            (@u1, 299.00, 'Plus', 'order_mock_fail', NULL, 'failed', DATEADD(hour, -2, SYSUTCDATETIME())),
            (@u2, 0.00, 'Free', 'free_mock_1', 'free_activation', 'verified', DATEADD(day, -10, SYSUTCDATETIME()))
        `);
    }
  }
}

async function logPayment(pool, userId, amount, planPurchased, razorpayOrderId, razorpayPaymentId, status) {
  await ensurePaymentsTable(pool);

  if (razorpayOrderId) {
    const existing = await pool.request()
      .input("orderId", sql.NVarChar(100), razorpayOrderId)
      .query("SELECT id FROM Payments WHERE razorpayOrderId = @orderId");

    if (existing.recordset.length > 0) {
      await pool.request()
        .input("orderId", sql.NVarChar(100), razorpayOrderId)
        .input("paymentId", sql.NVarChar(100), razorpayPaymentId || null)
        .input("status", sql.NVarChar(50), status)
        .query("UPDATE Payments SET razorpayPaymentId = @paymentId, status = @status, createdAt = SYSUTCDATETIME() WHERE razorpayOrderId = @orderId");
      return;
    }
  }

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("amount", sql.Decimal(10, 2), amount)
    .input("planPurchased", sql.NVarChar(100), planPurchased)
    .input("orderId", sql.NVarChar(100), razorpayOrderId || null)
    .input("paymentId", sql.NVarChar(100), razorpayPaymentId || null)
    .input("status", sql.NVarChar(50), status)
    .query(`
      INSERT INTO Payments (userId, amount, planPurchased, razorpayOrderId, razorpayPaymentId, status)
      VALUES (@userId, @amount, @planPurchased, @orderId, @paymentId, @status)
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

async function ensureReviewsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Reviews', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Reviews (
        id INT IDENTITY PRIMARY KEY,
        bookingId INT NOT NULL,
        userId INT NOT NULL,
        tailorApplicationId INT NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment NVARCHAR(500) NULL,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // Seed mock reviews if empty
  const countRes = await pool.request().query("SELECT COUNT(*) AS cnt FROM dbo.Reviews");
  if (countRes.recordset[0].cnt === 0) {
    const usersRes = await pool.request().query("SELECT TOP 5 id FROM dbo.Users");
    const tailorsRes = await pool.request().query("SELECT TOP 5 id FROM dbo.JoinApplications WHERE status = 'approved'");

    const userIds = usersRes.recordset.map(r => r.id);
    const tailorIds = tailorsRes.recordset.map(r => r.id);

    if (userIds.length > 0 && tailorIds.length > 0) {
      const u1 = userIds[0];
      const u2 = userIds[1] || u1;
      const t1 = tailorIds[0];
      const t2 = tailorIds[1] || t1;

      await pool.request()
        .input("u1", sql.Int, u1)
        .input("u2", sql.Int, u2)
        .input("t1", sql.Int, t1)
        .input("t2", sql.Int, t2)
        .query(`
          INSERT INTO dbo.Reviews (bookingId, userId, tailorApplicationId, rating, comment, createdAt)
          VALUES 
            (1, @u1, @t1, 5, 'Absolutely incredible fit! The stitching is precise and the fabric feels premium.', DATEADD(day, -4, SYSUTCDATETIME())),
            (2, @u2, @t1, 4, 'Very good service, pickup was on time. The waist was slightly loose but acceptable.', DATEADD(day, -3, SYSUTCDATETIME())),
            (3, @u1, @t2, 5, 'Highly recommend this tailor! Completed my alterations in less than 24 hours.', DATEADD(day, -2, SYSUTCDATETIME())),
            (4, @u2, @t2, 1, 'Fake profile review or abusive comment. Do not recommend this tailor.', DATEADD(hour, -5, SYSUTCDATETIME()))
        `);
    }
  }
}

async function ensureReferralsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Referrals', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Referrals (
        id INT IDENTITY PRIMARY KEY,
        referrerUserId INT NOT NULL,
        referredUserId INT NOT NULL,
        referralCode NVARCHAR(20) NOT NULL,
        rewardGranted BIT DEFAULT 0,
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // Seed mock referrals if empty
  const countRes = await pool.request().query("SELECT COUNT(*) AS cnt FROM dbo.Referrals");
  if (countRes.recordset[0].cnt === 0) {
    const usersRes = await pool.request().query("SELECT TOP 5 id FROM dbo.Users");
    const userIds = usersRes.recordset.map(r => r.id);
    if (userIds.length > 1) {
      const u1 = userIds[0];
      const u2 = userIds[1];
      const u3 = userIds[2] || u1;

      await pool.request()
        .input("u1", sql.Int, u1)
        .input("u2", sql.Int, u2)
        .input("u3", sql.Int, u3)
        .query(`
          INSERT INTO dbo.Referrals (referrerUserId, referredUserId, referralCode, rewardGranted, createdAt)
          VALUES 
            (@u1, @u2, 'REF-MOCK1', 1, DATEADD(day, -10, SYSUTCDATETIME())),
            (@u2, @u3, 'REF-MOCK2', 0, DATEADD(day, -2, SYSUTCDATETIME())),
            (@u1, @u3, 'REF-MOCK1', 0, DATEADD(hour, -4, SYSUTCDATETIME()))
        `);

      // Add seed credits
      await pool.request()
        .input("u1", sql.Int, u1)
        .input("u2", sql.Int, u2)
        .query(`
          UPDATE dbo.Users SET credit = 100.00 WHERE id = @u1;
          UPDATE dbo.Users SET credit = 50.00 WHERE id = @u2;
        `);
    }
  }
}

async function ensureBusinessOrdersTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.BusinessOrders', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.BusinessOrders (
        id INT IDENTITY PRIMARY KEY,
        userId INT NOT NULL,
        companyName NVARCHAR(255) NOT NULL,
        contactName NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phoneNumber NVARCHAR(20) NOT NULL,
        businessType NVARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        requirements NVARCHAR(MAX) NULL,
        approxPrice DECIMAL(10,2) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        deliveredAt DATETIME2 NULL,
        targetDeliveryDate DATE NULL,
        location NVARCHAR(255) NULL,
        tailorApplicationId INT NULL,
        tailorName NVARCHAR(200) NULL,
        tailorEmail NVARCHAR(255) NULL,
        tailorPhoneNumber NVARCHAR(20) NULL,
        CONSTRAINT FK_BusinessOrders_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
      );
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'deliveredAt') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD deliveredAt DATETIME2 NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'targetDeliveryDate') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD targetDeliveryDate DATE NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'location') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD location NVARCHAR(255) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'tailorApplicationId') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD tailorApplicationId INT NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'tailorName') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD tailorName NVARCHAR(200) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'tailorEmail') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD tailorEmail NVARCHAR(255) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.BusinessOrders', 'tailorPhoneNumber') IS NULL
    BEGIN
      ALTER TABLE dbo.BusinessOrders ADD tailorPhoneNumber NVARCHAR(20) NULL;
    END
  `);
}

async function generateUniqueReferralCode(pool) {
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
    code = `STITCH-${randomChars}`;
    const checkResult = await pool.request()
      .input("code", sql.NVarChar(20), code)
      .query("SELECT 1 FROM Users WHERE referralCode = @code");
    if (checkResult.recordset.length === 0) {
      isUnique = true;
    }
  }
  return code;
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
        isBanned BIT NOT NULL DEFAULT 0,
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
    IF COL_LENGTH('dbo.Users', 'isBanned') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD isBanned BIT NOT NULL DEFAULT 0;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'referralCode') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD referralCode NVARCHAR(20) NULL;
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.Users', 'credit') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD credit DECIMAL(10,2) NOT NULL DEFAULT 0.00;
    END
  `);

  // Migrate existing users who have NULL referralCode
  const unmigratedUsers = await pool.request().query(`
    SELECT id FROM Users WHERE referralCode IS NULL
  `);
  for (const user of unmigratedUsers.recordset) {
    const code = await generateUniqueReferralCode(pool);
    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("code", sql.NVarChar(20), code)
      .query("UPDATE Users SET referralCode = @code WHERE id = @userId");
  }

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
      const pool = await getSqlPool();
      const banCheck = await pool
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT isBanned FROM Users WHERE id = @userId");
      const user = banCheck.recordset[0];
      if (user && user.isBanned) {
        return response.status(403).json({
          message: "Forbidden: Your account has been deactivated.",
        });
      }
    }
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
  return getAuthenticatedUserId(request) === Number(userId) || request.user?.role === "admin";
}

async function ensureAppSettingsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.AppSettings', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AppSettings (
        [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [value] NVARCHAR(1000) NOT NULL,
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.AppSettings WHERE [key] = 'disableNewRegistrations')
    BEGIN
      INSERT INTO dbo.AppSettings ([key], [value]) VALUES ('disableNewRegistrations', 'false');
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.AppSettings WHERE [key] = 'maintenanceMode')
    BEGIN
      INSERT INTO dbo.AppSettings ([key], [value]) VALUES ('maintenanceMode', 'false');
    END
  `);
}

async function getAppSettings(pool) {
  await ensureAppSettingsTable(pool);
  const result = await pool.request().query(`
    SELECT [key], [value]
    FROM dbo.AppSettings
    WHERE [key] IN ('disableNewRegistrations', 'maintenanceMode')
  `);

  return result.recordset.reduce(
    (settings, row) => ({
      ...settings,
      [row.key]: String(row.value).toLowerCase() === "true",
    }),
    {
      disableNewRegistrations: false,
      maintenanceMode: false,
    },
  );
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
    const referralCodeUsed = String(request.body.referralCodeUsed || "").trim();

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
    await ensureReferralsTable(pool);

    const appSettings = await getAppSettings(pool);
    if (appSettings.disableNewRegistrations) {
      return response.status(503).json({
        message: "New registrations are temporarily disabled",
      });
    }

    let referrerUserId = null;
    if (referralCodeUsed) {
      const referrerResult = await pool
        .request()
        .input("code", sql.NVarChar(20), referralCodeUsed)
        .query("SELECT id FROM Users WHERE referralCode = @code");
      if (referrerResult.recordset.length === 0) {
        return response.status(400).json({
          message: "Invalid referral code",
        });
      }
      referrerUserId = referrerResult.recordset[0].id;
    }

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
    const referralCode = await generateUniqueReferralCode(pool);

    const result = await pool
      .request()
      .input("fullName", sql.NVarChar(150), fullName)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("passwordHash", sql.NVarChar(255), passwordHash)
      .input("role", sql.NVarChar(50), role)
      .input("referralCode", sql.NVarChar(20), referralCode)
      .query(`
        INSERT INTO Users (fullName, email, phoneNumber, passwordHash, role, referralCode, credit)
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.[plan], INSERTED.referralCode, INSERTED.credit
        VALUES (@fullName, @email, @phoneNumber, @passwordHash, @role, @referralCode, 0)
      `);

    const newUser = result.recordset[0];

    if (referrerUserId) {
      await pool
        .request()
        .input("referrerUserId", sql.Int, referrerUserId)
        .input("referredUserId", sql.Int, newUser.id)
        .input("referralCode", sql.NVarChar(20), referralCodeUsed)
        .query(`
          INSERT INTO Referrals (referrerUserId, referredUserId, referralCode, rewardGranted)
          VALUES (@referrerUserId, @referredUserId, @referralCode, 0)
        `);
    }

    return response.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        plan: newUser.plan || "Free",
        referralCode: newUser.referralCode,
        credit: newUser.credit !== undefined ? Number(newUser.credit) : 0,
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
        SELECT id, fullName, email, phoneNumber, isBanned
        FROM Users
        WHERE phoneNumber = @phoneNumber
      `);

    const user = userResult.recordset[0];

    if (!user) {
      return response.status(404).json({
        message: "Phone number is not registered",
      });
    }

    if (user.isBanned) {
      return response.status(403).json({
        message: "Your account has been deactivated.",
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
        SELECT id, fullName, email, phoneNumber, role, [plan], firstName, lastName, address, image, referralCode, credit, isBanned
        FROM Users
        WHERE phoneNumber = @phoneNumber
      `);

    const user = userResult.recordset[0];

    if (user && user.isBanned) {
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
          : error.originalError?.message || error.message,
    });
  }
});

app.use("/api", authenticateApiRequest);

app.use("/api", async (request, response, next) => {
  if (request.user?.role === "admin") {
    return next();
  }

  try {
    const pool = await getSqlPool();
    const appSettings = await getAppSettings(pool);
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
    const pool = await getSqlPool();
    await ensureAuthTables(pool);
    await ensureBookingsTable(pool);
    await ensureJoinTable(pool);

    const userStatsResult = await pool.request().query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS users,
        SUM(CASE WHEN role = 'tailor' THEN 1 ELSE 0 END) AS tailors,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins
      FROM Users
    `);

    const bookingStatsResult = await pool.request().query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('pending', 'pending-price', 'pending-payment') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status IN ('booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery') THEN 1 ELSE 0 END) AS booked,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM Bookings
    `);

    const revenueResult = await pool.request().query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN status IN ('booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered')
            THEN
              CASE
                WHEN (COALESCE(approxPrice, 0) + ROUND(COALESCE(approxPrice, 0) * 0.18, 0) + 49 - COALESCE(referralDiscount, 0) - COALESCE(creditApplied, 0)) < 0
                THEN 0
                ELSE (COALESCE(approxPrice, 0) + ROUND(COALESCE(approxPrice, 0) * 0.18, 0) + 49 - COALESCE(referralDiscount, 0) - COALESCE(creditApplied, 0))
              END
            ELSE 0
          END
        ), 0) AS totalCollected
      FROM Bookings
    `);

    const applicationsResult = await pool.request().query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM JoinApplications
    `);

    const recentUsersResult = await pool.request().query(`
      SELECT TOP 5 id, fullName, role, createdAt
      FROM Users
      ORDER BY createdAt DESC
    `);

    const recentBookingsResult = await pool.request().query(`
      SELECT TOP 5 b.id, b.status, b.approxPrice, b.createdAt, u.fullName
      FROM Bookings b
      LEFT JOIN Users u ON u.id = b.userId
      ORDER BY b.createdAt DESC
    `);

    const recentApplicationsResult = await pool.request().query(`
      SELECT TOP 5 id, firstName, lastName, status, createdAt
      FROM JoinApplications
      ORDER BY createdAt DESC
    `);

    const recentActivity = [
      ...recentBookingsResult.recordset.map((booking) => ({
        id: `booking-${booking.id}`,
        type: "booking",
        title: `Booking #${booking.id} ${booking.status || "created"}`,
        detail: booking.fullName ? `Customer: ${booking.fullName}` : "Customer booking activity",
        amount: booking.approxPrice !== undefined && booking.approxPrice !== null ? Number(booking.approxPrice) : null,
        createdAt: booking.createdAt,
      })),
      ...recentApplicationsResult.recordset.map((application) => ({
        id: `application-${application.id}`,
        type: "application",
        title: `${[application.firstName, application.lastName].filter(Boolean).join(" ") || "Tailor"} application`,
        detail: `Status: ${application.status || "pending"}`,
        amount: null,
        createdAt: application.createdAt,
      })),
      ...recentUsersResult.recordset.map((user) => ({
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

    const userStats = userStatsResult.recordset[0] || {};
    const bookingStats = bookingStatsResult.recordset[0] || {};
    const revenueStats = revenueResult.recordset[0] || {};
    const applicationStats = applicationsResult.recordset[0] || {};

    return response.json({
      users: {
        total: Number(userStats.total || 0),
        users: Number(userStats.users || 0),
        tailors: Number(userStats.tailors || 0),
        admins: Number(userStats.admins || 0),
      },
      bookings: {
        total: Number(bookingStats.total || 0),
        pending: Number(bookingStats.pending || 0),
        booked: Number(bookingStats.booked || 0),
        delivered: Number(bookingStats.delivered || 0),
        cancelled: Number(bookingStats.cancelled || 0),
      },
      revenue: {
        totalCollected: Number(revenueStats.totalCollected || 0),
        currency: "INR",
      },
      applications: {
        total: Number(applicationStats.total || 0),
        pending: Number(applicationStats.pending || 0),
        approved: Number(applicationStats.approved || 0),
        rejected: Number(applicationStats.rejected || 0),
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Admin summary error:", error);
    return response.status(500).json({
      message: "Unable to load admin summary",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/admin/settings", requireAdmin, async (_request, response) => {
  try {
    const pool = await getSqlPool();
    await ensureAuthTables(pool);
    const settings = await getAppSettings(pool);

    const adminsResult = await pool.request().query(`
      SELECT id, fullName, email, phoneNumber, role, isBanned, createdAt
      FROM Users
      WHERE role = 'admin'
      ORDER BY createdAt DESC
    `);

    const healthResult = await pool.request().query("SELECT DB_NAME() AS databaseName");

    return response.json({
      settings,
      admins: adminsResult.recordset,
      backendHealth: {
        status: "ok",
        database: healthResult.recordset[0]?.databaseName || "unknown",
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Admin settings load error:", error);
    return response.status(500).json({
      message: "Unable to load admin settings",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.patch("/api/admin/settings", requireAdmin, async (request, response) => {
  try {
    const pool = await getSqlPool();
    await ensureAppSettingsTable(pool);

    const allowedKeys = ["disableNewRegistrations", "maintenanceMode"];
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(request.body, key)) {
        await pool
          .request()
          .input("key", sql.NVarChar(100), key)
          .input("value", sql.NVarChar(1000), request.body[key] ? "true" : "false")
          .query(`
            UPDATE dbo.AppSettings
            SET [value] = @value, updatedAt = SYSUTCDATETIME()
            WHERE [key] = @key
          `);
      }
    }

    const settings = await getAppSettings(pool);
    return response.json({
      message: "Settings updated",
      settings,
    });
  } catch (error) {
    console.error("Admin settings update error:", error);
    return response.status(500).json({
      message: "Unable to update admin settings",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
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

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    const result = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        UPDATE Users
        SET role = 'admin'
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.isBanned, INSERTED.createdAt
        WHERE phoneNumber = @phoneNumber
      `);

    const admin = result.recordset[0];
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
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
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

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    const adminCountResult = await pool.request().query("SELECT COUNT(*) AS count FROM Users WHERE role = 'admin'");
    if (Number(adminCountResult.recordset[0]?.count || 0) <= 1) {
      return response.status(400).json({
        message: "At least one admin account is required",
      });
    }

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        UPDATE Users
        SET role = 'user'
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role, INSERTED.isBanned, INSERTED.createdAt
        WHERE id = @userId AND role = 'admin'
      `);

    if (!result.recordset[0]) {
      return response.status(404).json({
        message: "Admin account not found",
      });
    }

    return response.json({
      message: "Admin access removed",
      user: result.recordset[0],
    });
  } catch (error) {
    console.error("Admin account remove error:", error);
    return response.status(500).json({
      message: "Unable to remove admin access",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.originalError?.message || error.message,
    });
  }
});

app.get("/api/admin/users", requireAdmin, async (request, response) => {
  try {
    const roleFilter = request.query.role || "";
    const planFilter = request.query.plan || "";
    const searchQuery = request.query.search || "";

    const pool = await getSqlPool();
    await ensureAuthTables(pool);

    let query = `
      SELECT id, fullName, email, phoneNumber, role, [plan], isBanned, createdAt
      FROM Users
      WHERE 1=1
    `;
    const req = pool.request();

    if (roleFilter) {
      query += " AND role = @role";
      req.input("role", sql.NVarChar(50), roleFilter);
    }
    if (planFilter) {
      query += " AND [plan] = @plan";
      req.input("plan", sql.NVarChar(50), planFilter);
    }
    if (searchQuery) {
      query += " AND (fullName LIKE @search OR email LIKE @search OR phoneNumber LIKE @search)";
      req.input("search", sql.NVarChar(255), `%${searchQuery}%`);
    }

    query += " ORDER BY createdAt DESC";

    const result = await req.query(query);
    return response.json({ users: result.recordset });
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

    const pool = await getSqlPool();
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("role", sql.NVarChar(50), newRole)
      .query("UPDATE Users SET role = @role WHERE id = @userId");

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

    const pool = await getSqlPool();
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("isBanned", sql.Bit, isBanned ? 1 : 0)
      .query("UPDATE Users SET isBanned = @isBanned WHERE id = @userId");

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
    const pool = await getSqlPool();

    // First fetch the user details to see if they are a tailor
    const userResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT email, phoneNumber, role FROM Users WHERE id = @userId");
    const user = userResult.recordset[0];

    if (!user) {
      return response.status(404).json({ message: "User not found" });
    }

    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const userPhone = user.phoneNumber ? user.phoneNumber.trim() : "";
    const isTailor = user.role === "tailor";

    let bookingsQuery = `
      SELECT id, userId, pickupLocation, dropoffLocation, bookingDate, bookingTime, tailorName, tailorEmail, clothCategory, approxPrice, status, trackingCode, createdAt
      FROM Bookings
      WHERE userId = @userId
    `;

    const req = pool.request().input("userId", sql.Int, userId);

    if (isTailor) {
      bookingsQuery += `
        OR (tailorEmail = @tailorEmail OR tailorPhoneNumber = @tailorPhone)
      `;
      req.input("tailorEmail", sql.NVarChar(255), userEmail);
      req.input("tailorPhone", sql.NVarChar(20), userPhone);
    }

    bookingsQuery += " ORDER BY createdAt DESC";
    const bookingsResult = await req.query(bookingsQuery);

    let businessQuery = `
      SELECT id, userId, companyName, contactName, email, phoneNumber, businessType, quantity, approxPrice, status, targetDeliveryDate, createdAt
      FROM BusinessOrders
      WHERE userId = @userId
    `;
    const reqBiz = pool.request().input("userId", sql.Int, userId);

    if (isTailor) {
      businessQuery += `
        OR (tailorEmail = @tailorEmail OR tailorPhoneNumber = @tailorPhone)
      `;
      reqBiz.input("tailorEmail", sql.NVarChar(255), userEmail);
      reqBiz.input("tailorPhone", sql.NVarChar(20), userPhone);
    }

    businessQuery += " ORDER BY createdAt DESC";
    const businessResult = await reqBiz.query(businessQuery);

    return response.json({
      bookings: bookingsResult.recordset,
      businessOrders: businessResult.recordset
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

    const pool = await getSqlPool();
    const appResult = await pool.request()
      .input("id", sql.Int, applicationId)
      .query("SELECT * FROM JoinApplications WHERE id = @id");

    const appRecord = appResult.recordset[0];
    if (!appRecord) {
      return response.status(404).json({ message: "Application not found" });
    }

    if (appRecord.status === "approved") {
      return response.status(400).json({ message: "Application is already approved" });
    }

    await pool.request()
      .input("id", sql.Int, applicationId)
      .query("UPDATE JoinApplications SET status = 'approved', rejectionReason = NULL WHERE id = @id");

    const email = appRecord.email ? appRecord.email.toLowerCase().trim() : "";
    const phoneNumber = appRecord.phoneNumber ? appRecord.phoneNumber.trim() : "";

    const userCheck = await pool.request()
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query("SELECT id FROM Users WHERE (email = @email AND @email <> '') OR (phoneNumber = @phoneNumber AND @phoneNumber <> '')");

    let promoted = false;
    if (userCheck.recordset.length > 0) {
      const userId = userCheck.recordset[0].id;
      const fullName = `${appRecord.firstName} ${appRecord.lastName}`.trim();

      await pool.request()
        .input("userId", sql.Int, userId)
        .input("fullName", sql.NVarChar(150), fullName)
        .input("firstName", sql.NVarChar(100), appRecord.firstName)
        .input("lastName", sql.NVarChar(100), appRecord.lastName)
        .input("address", sql.NVarChar(255), appRecord.location)
        .input("image", sql.NVarChar(sql.MAX), appRecord.image)
        .input("plan", sql.NVarChar(50), appRecord.plan || "Free")
        .query(`
          UPDATE Users
          SET 
            role = 'tailor',
            fullName = @fullName,
            firstName = @firstName,
            lastName = @lastName,
            address = @address,
            image = @image,
            [plan] = @plan
          WHERE id = @userId
        `);
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

    const pool = await getSqlPool();
    const appResult = await pool.request()
      .input("id", sql.Int, applicationId)
      .query("SELECT * FROM JoinApplications WHERE id = @id");

    const appRecord = appResult.recordset[0];
    if (!appRecord) {
      return response.status(404).json({ message: "Application not found" });
    }

    await pool.request()
      .input("id", sql.Int, applicationId)
      .input("reason", sql.NVarChar(500), reason)
      .query("UPDATE JoinApplications SET status = 'rejected', rejectionReason = @reason WHERE id = @id");

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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);

    let query = `
      SELECT 
        b.id,
        b.userId,
        b.pickupLocation,
        b.dropoffLocation,
        b.bookingDate,
        b.bookingTime,
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
        u.fullName AS customerName,
        u.email AS customerEmail,
        u.phoneNumber AS customerPhone
      FROM Bookings b
      LEFT JOIN Users u ON b.userId = u.id
      WHERE 1=1
    `;

    const req = pool.request();
    if (status) {
      query += " AND b.status = @status";
      req.input("status", sql.NVarChar(50), status);
    }
    if (search) {
      query += " AND (u.fullName LIKE @search OR b.tailorName LIKE @search OR b.trackingCode LIKE @search OR b.clothCategory LIKE @search)";
      req.input("search", sql.NVarChar(100), `%${search}%`);
    }

    query += " ORDER BY b.createdAt DESC";
    const result = await req.query(query);

    return response.json({ bookings: result.recordset });
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

    const pool = await getSqlPool();
    const result = await pool.request()
      .input("bookingId", sql.Int, bookingId)
      .query(`
        SELECT 
          b.*,
          u.fullName AS customerName,
          u.email AS customerEmail,
          u.phoneNumber AS customerPhone
        FROM Bookings b
        LEFT JOIN Users u ON b.userId = u.id
        WHERE b.id = @bookingId
      `);

    const booking = result.recordset[0];
    if (!booking) {
      return response.status(404).json({ message: "Booking not found" });
    }

    let measurements = null;
    if (booking.userId) {
      const measurementsResult = await pool.request()
        .input("userId", sql.Int, booking.userId)
        .query("SELECT * FROM Measurements WHERE userId = @userId");
      measurements = measurementsResult.recordset[0] || null;
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

    const pool = await getSqlPool();
    const checkResult = await pool.request()
      .input("id", sql.Int, bookingId)
      .query("SELECT id FROM Bookings WHERE id = @id");

    if (checkResult.recordset.length === 0) {
      return response.status(404).json({ message: "Booking not found" });
    }

    let updateQuery = "UPDATE Bookings SET status = @status";
    const req = pool.request()
      .input("id", sql.Int, bookingId)
      .input("status", sql.NVarChar(50), status);

    if (trackingCode !== undefined) {
      updateQuery += ", trackingCode = @trackingCode";
      req.input("trackingCode", sql.NVarChar(10), trackingCode || null);
    }

    if (approxPrice !== undefined) {
      updateQuery += ", approxPrice = @approxPrice";
      req.input("approxPrice", sql.Decimal(10, 2), approxPrice !== null && approxPrice !== "" ? Number(approxPrice) : null);
    }

    updateQuery += " WHERE id = @id";
    await req.query(updateQuery);

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

    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    let query = `
      SELECT bo.*, u.fullName AS userFullName
      FROM BusinessOrders bo
      LEFT JOIN Users u ON u.id = bo.userId
      WHERE 1=1
    `;

    const req = pool.request();
    if (status) {
      query += " AND bo.status = @status";
      req.input("status", sql.NVarChar(50), status);
    }
    if (search) {
      query += " AND (bo.companyName LIKE @search OR bo.contactName LIKE @search OR bo.email LIKE @search OR bo.tailorName LIKE @search OR bo.businessType LIKE @search)";
      req.input("search", sql.NVarChar(100), `%${search}%`);
    }

    query += " ORDER BY bo.createdAt DESC";
    const result = await req.query(query);

    return response.json({ businessOrders: result.recordset });
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

    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    const orderCheck = await pool.request()
      .input("id", sql.Int, orderId)
      .query("SELECT id FROM BusinessOrders WHERE id = @id");
    if (orderCheck.recordset.length === 0) {
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
        const tailorRes = await pool.request()
          .input("tailorId", sql.Int, Number(tailorId))
          .query("SELECT firstName + ' ' + lastName AS fullName, email, phoneNumber FROM JoinApplications WHERE id = @tailorId");
        if (tailorRes.recordset.length > 0) {
          const t = tailorRes.recordset[0];
          tailorName = t.fullName;
          tailorEmail = t.email;
          tailorPhoneNumber = t.phoneNumber;
        } else {
          return response.status(400).json({ message: "Invalid tailor selection" });
        }
      }
    }

    let updateQuery = "UPDATE BusinessOrders SET id = id";
    const req = pool.request().input("id", sql.Int, orderId);

    if (status !== undefined) {
      updateQuery += ", status = @status";
      req.input("status", sql.NVarChar(50), status);
      if (status === "delivered") {
        updateQuery += ", deliveredAt = SYSUTCDATETIME()";
      }
    }

    if (approxPrice !== undefined) {
      updateQuery += ", approxPrice = @approxPrice";
      req.input("approxPrice", sql.Decimal(10, 2), approxPrice !== null && approxPrice !== "" ? Number(approxPrice) : null);
    }

    if (targetDeliveryDate !== undefined) {
      updateQuery += ", targetDeliveryDate = @targetDeliveryDate";
      req.input("targetDeliveryDate", sql.Date, targetDeliveryDate ? new Date(targetDeliveryDate) : null);
    }

    if (tailorId !== undefined) {
      updateQuery += `, tailorApplicationId = @tailorId, tailorName = @tailorName, tailorEmail = @tailorEmail, tailorPhoneNumber = @tailorPhoneNumber`;
      req.input("tailorId", sql.Int, tailorId ? Number(tailorId) : null);
      req.input("tailorName", sql.NVarChar(200), tailorName);
      req.input("tailorEmail", sql.NVarChar(255), tailorEmail);
      req.input("tailorPhoneNumber", sql.NVarChar(20), tailorPhoneNumber);
    }

    updateQuery += " WHERE id = @id";
    await req.query(updateQuery);

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

    const pool = await getSqlPool();
    await ensurePaymentsTable(pool);

    let query = `
      SELECT p.*, u.fullName AS customerName, u.email AS customerEmail, u.phoneNumber AS customerPhone
      FROM Payments p
      LEFT JOIN Users u ON u.id = p.userId
      WHERE 1=1
    `;

    const req = pool.request();
    if (status) {
      query += " AND p.status = @status";
      req.input("status", sql.NVarChar(50), status);
    }
    if (search) {
      query += " AND (u.fullName LIKE @search OR u.email LIKE @search OR p.planPurchased LIKE @search OR p.razorpayOrderId LIKE @search OR p.razorpayPaymentId LIKE @search)";
      req.input("search", sql.NVarChar(100), `%${search}%`);
    }
    if (startDate) {
      query += " AND p.createdAt >= @startDate";
      req.input("startDate", sql.DateTime2, new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query += " AND p.createdAt < @endDate";
      req.input("endDate", sql.DateTime2, end);
    }

    query += " ORDER BY p.createdAt DESC";
    const result = await req.query(query);

    const breakdownQuery = await pool.request().query(`
      SELECT 
        planPurchased,
        SUM(amount) AS totalAmount
      FROM Payments
      WHERE status = 'verified'
      GROUP BY planPurchased
    `);

    let freeRevenue = 0;
    let plusRevenue = 0;
    let proRevenue = 0;
    let bookingsRevenue = 0;

    breakdownQuery.recordset.forEach((row) => {
      const plan = String(row.planPurchased).toLowerCase();
      const amt = Number(row.totalAmount || 0);

      if (plan === "free") {
        freeRevenue += amt;
      } else if (plan === "plus") {
        plusRevenue += amt;
      } else if (plan === "pro") {
        proRevenue += amt;
      } else {
        bookingsRevenue += amt;
      }
    });

    return response.json({
      payments: result.recordset,
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

    const pool = await getSqlPool();
    await ensureReviewsTable(pool);

    let query = `
      SELECT 
        r.id,
        r.bookingId,
        r.userId,
        r.tailorApplicationId,
        r.rating,
        r.comment,
        r.createdAt,
        u.fullName AS customerName,
        u.email AS customerEmail,
        ja.firstName + ' ' + ja.lastName AS tailorName,
        ja.email AS tailorEmail
      FROM Reviews r
      LEFT JOIN Users u ON u.id = r.userId
      LEFT JOIN JoinApplications ja ON ja.id = r.tailorApplicationId
      WHERE 1=1
    `;

    const req = pool.request();
    if (rating) {
      query += " AND r.rating = @rating";
      req.input("rating", sql.Int, rating);
    }
    if (search) {
      query += " AND (u.fullName LIKE @search OR ja.firstName LIKE @search OR ja.lastName LIKE @search OR r.comment LIKE @search)";
      req.input("search", sql.NVarChar(100), `%${search}%`);
    }

    query += " ORDER BY r.createdAt DESC";
    const reviewsResult = await req.query(query);

    const averagesResult = await pool.request().query(`
      SELECT 
        ja.id AS tailorId,
        ja.firstName + ' ' + ja.lastName AS tailorName,
        ja.email AS tailorEmail,
        AVG(CAST(r.rating AS DECIMAL(10,2))) AS averageRating,
        COUNT(r.id) AS reviewCount
      FROM Reviews r
      JOIN JoinApplications ja ON r.tailorApplicationId = ja.id
      GROUP BY ja.id, ja.firstName, ja.lastName, ja.email
      ORDER BY averageRating DESC
    `);

    return response.json({
      reviews: reviewsResult.recordset,
      averages: averagesResult.recordset
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

    const pool = await getSqlPool();
    await ensureReviewsTable(pool);

    const checkResult = await pool.request()
      .input("id", sql.Int, reviewId)
      .query("SELECT id FROM Reviews WHERE id = @id");
    if (checkResult.recordset.length === 0) {
      return response.status(404).json({ message: "Review not found" });
    }

    await pool.request()
      .input("id", sql.Int, reviewId)
      .query("DELETE FROM Reviews WHERE id = @id");

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
    const pool = await getSqlPool();
    await ensureReferralsTable(pool);

    const referralsResult = await pool.request().query(`
      SELECT 
        r.id,
        r.referrerUserId,
        r.referredUserId,
        r.referralCode,
        r.rewardGranted,
        r.createdAt,
        u1.fullName AS referrerName,
        u1.email AS referrerEmail,
        u1.credit AS referrerCredit,
        u2.fullName AS referredName,
        u2.email AS referredEmail,
        u2.credit AS referredCredit
      FROM Referrals r
      LEFT JOIN Users u1 ON u1.id = r.referrerUserId
      LEFT JOIN Users u2 ON u2.id = r.referredUserId
      ORDER BY r.createdAt DESC
    `);

    const usersResult = await pool.request().query(`
      SELECT id, fullName, email, phoneNumber, credit, role
      FROM Users
      ORDER BY credit DESC, fullName ASC
    `);

    return response.json({
      referrals: referralsResult.recordset,
      users: usersResult.recordset
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

    const pool = await getSqlPool();
    await ensureReferralsTable(pool);

    const refCheck = await pool.request()
      .input("id", sql.Int, referralId)
      .query("SELECT * FROM Referrals WHERE id = @id");
    const ref = refCheck.recordset[0];
    if (!ref) {
      return response.status(404).json({ message: "Referral relationship not found" });
    }

    await pool.request()
      .input("userId", sql.Int, ref.referrerUserId)
      .input("amount", sql.Decimal(10, 2), amount)
      .query("UPDATE Users SET credit = credit + @amount WHERE id = @userId");

    await pool.request()
      .input("id", sql.Int, referralId)
      .query("UPDATE Referrals SET rewardGranted = 1 WHERE id = @id");

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

    const pool = await getSqlPool();
    await ensureReferralsTable(pool);

    const refCheck = await pool.request()
      .input("id", sql.Int, referralId)
      .query("SELECT * FROM Referrals WHERE id = @id");
    const ref = refCheck.recordset[0];
    if (!ref) {
      return response.status(404).json({ message: "Referral relationship not found" });
    }

    await pool.request()
      .input("userId", sql.Int, ref.referrerUserId)
      .input("amount", sql.Decimal(10, 2), amount)
      .query("UPDATE Users SET credit = CASE WHEN credit - @amount < 0.00 THEN 0.00 ELSE credit - @amount END WHERE id = @userId");

    await pool.request()
      .input("id", sql.Int, referralId)
      .query("UPDATE Referrals SET rewardGranted = 0 WHERE id = @id");

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

    const pool = await getSqlPool();
    const userCheck = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT id FROM Users WHERE id = @id");
    if (userCheck.recordset.length === 0) {
      return response.status(404).json({ message: "User not found" });
    }

    await pool.request()
      .input("id", sql.Int, userId)
      .input("credit", sql.Decimal(10, 2), credit)
      .query("UPDATE Users SET credit = @credit WHERE id = @id");

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

    const pool = await getSqlPool();
    await ensureAuthTables(pool);
    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT id, fullName, email, phoneNumber, role, [plan], firstName, lastName, address, image, referralCode, credit
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
          INSERTED.firstName, INSERTED.lastName, INSERTED.address, INSERTED.image, INSERTED.referralCode, INSERTED.credit
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

    // Removed auto-deletion of delivered/out-for-delivery bookings to prevent loss of order history and tracking capability.

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
    await ensureReviewsTable(pool);

    const authenticatedUserId = getAuthenticatedUserId(request);
    const userRole = request.user?.role || "user";

    // Removed auto-deletion of delivered/out-for-delivery bookings to prevent loss of order history and tracking capability.
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
            b.referralDiscount,
            b.creditApplied,
            b.status,
            b.trackingCode,
            b.createdAt,
            m.chest,
            m.waist,
            m.hip,
            m.shoulder,
            m.inseam,
            r.id AS reviewId,
            r.rating AS reviewRating,
            r.comment AS reviewComment
          FROM Bookings b
          LEFT JOIN Users u ON u.id = b.userId
          LEFT JOIN Measurements m ON m.userId = b.userId
          LEFT JOIN Reviews r ON r.bookingId = b.id
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

    // Dynamically calculate and save discounts if pending payment
    if (booking.status === "pending-payment" && Number(booking.userId) === getAuthenticatedUserId(request)) {
      try {
        const userId = Number(booking.userId);
        const bookingId = Number(booking.id);
        const basePrice = Number(booking.approxPrice || 0);
        const gstFee = Math.round(basePrice * 0.18);
        const platformFee = 49;
        const totalBasePrice = basePrice + gstFee + platformFee;

        let referralDiscountApplied = 0;
        let creditApplied = 0;

        // Check if user is referred and has not had a booking confirmed yet
        const referralRes = await pool.request()
          .input("userId", sql.Int, userId)
          .query("SELECT TOP 1 id FROM Referrals WHERE referredUserId = @userId");

        if (referralRes.recordset.length > 0) {
          const bookedCountResult = await pool.request()
            .input("userId", sql.Int, userId)
            .input("bookingId", sql.Int, bookingId)
            .query(`
              SELECT COUNT(id) AS cnt 
              FROM Bookings 
              WHERE userId = @userId 
                AND status IN ('booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered')
                AND id <> @bookingId
            `);
          if (bookedCountResult.recordset[0].cnt === 0) {
            referralDiscountApplied = 50.00;
          }
        }

        // Check user available credit balance
        const userCreditRes = await pool.request()
          .input("userId", sql.Int, userId)
          .query("SELECT credit FROM Users WHERE id = @userId");
        const availableCredit = Number(userCreditRes.recordset[0]?.credit || 0);

        let tempPrice = totalBasePrice - referralDiscountApplied;
        if (tempPrice < 0) tempPrice = 0;

        creditApplied = Math.min(availableCredit, tempPrice);

        // Update database with the latest calculations
        await pool.request()
          .input("bookingId", sql.Int, bookingId)
          .input("referralDiscount", sql.Decimal(10, 2), referralDiscountApplied)
          .input("creditApplied", sql.Decimal(10, 2), creditApplied)
          .query(`
            UPDATE Bookings 
            SET referralDiscount = @referralDiscount,
                creditApplied = @creditApplied
            WHERE id = @bookingId
          `);

        booking.referralDiscount = referralDiscountApplied;
        booking.creditApplied = creditApplied;
      } catch (err) {
        console.error("Error calculating dynamic discounts on GET:", err);
      }
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
            image = @image
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
        rejectionReason,
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

    const pool = await getSqlPool();
    await ensureJoinTable(pool);
    await ensureReviewsTable(pool);
    const result = await pool.request().query(`
      SELECT
        ja.id,
        ja.firstName,
        ja.lastName,
        ja.email,
        ja.phoneNumber,
        ja.experience,
        ja.location,
        ja.image,
        ja.[plan],
        ja.status,
        ja.createdAt,
        COALESCE(AVG(CAST(r.rating AS DECIMAL(10,2))), 0) AS avgRating,
        COUNT(r.id) AS reviewCount
      FROM JoinApplications ja
      LEFT JOIN Reviews r ON ja.id = r.tailorApplicationId
      WHERE ja.status IN ('approved', 'pending')
      GROUP BY 
        ja.id, ja.firstName, ja.lastName, ja.email, ja.phoneNumber, 
        ja.experience, ja.location, ja.image, ja.[plan], ja.status, ja.createdAt
    `);
    const planWeights = {
      'Pro': 3,
      'Plus': 2,
      'Free': 1
    };

    let tailors = [];

    if (isCoordsSearch) {
      const tailorsWithDistancePromises = result.recordset.map(async (tailor) => {
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
          plan: tailor.plan || "Free",
          avgRating: Number(tailor.avgRating || 0),
          reviewCount: Number(tailor.reviewCount || 0),
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
      tailors = result.recordset
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
          avgRating: Number(tailor.avgRating || 0),
          reviewCount: Number(tailor.reviewCount || 0),
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

    await ensureReviewsTable(pool);
    const ratingResult = await pool
      .request()
      .input("tailorId", sql.Int, tailorId)
      .query(`
        SELECT 
          COALESCE(AVG(CAST(rating AS DECIMAL(10,2))), 0) AS avgRating,
          COUNT(id) AS reviewCount
        FROM Reviews
        WHERE tailorApplicationId = @tailorId
      `);
    const ratingInfo = ratingResult.recordset[0];
    const avgRating = Number(ratingInfo?.avgRating || 0);
    const reviewCount = Number(ratingInfo?.reviewCount || 0);

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
        avgRating,
        reviewCount,
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

    const pool = await getSqlPool();
    let finalPrice = price;
    let referralDiscountApplied = 0;
    let creditApplied = 0;

    if (planId.startsWith("booking_")) {
      const bookingId = Number(planId.replace("booking_", ""));
      const bookingResult = await pool.request()
        .input("bookingId", sql.Int, bookingId)
        .query("SELECT approxPrice FROM Bookings WHERE id = @bookingId");
      const booking = bookingResult.recordset[0];
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
      const referralRes = await pool.request()
        .input("userId", sql.Int, userId)
        .query("SELECT TOP 1 id FROM Referrals WHERE referredUserId = @userId");

      if (referralRes.recordset.length > 0) {
        const bookedCountResult = await pool.request()
          .input("userId", sql.Int, userId)
          .input("bookingId", sql.Int, bookingId)
          .query(`
            SELECT COUNT(id) AS cnt 
            FROM Bookings 
            WHERE userId = @userId 
              AND status IN ('booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered')
              AND id <> @bookingId
          `);
        if (bookedCountResult.recordset[0].cnt === 0) {
          referralDiscountApplied = 50.00;
        }
      }

      // Check user available credit balance
      const userCreditRes = await pool.request()
        .input("userId", sql.Int, userId)
        .query("SELECT credit FROM Users WHERE id = @userId");
      const availableCredit = Number(userCreditRes.recordset[0]?.credit || 0);

      let tempPrice = totalBasePrice - referralDiscountApplied;
      if (tempPrice < 0) tempPrice = 0;

      creditApplied = Math.min(availableCredit, tempPrice);
      finalPrice = tempPrice - creditApplied;
      if (finalPrice < 0) finalPrice = 0;

      // Save referralDiscount and creditApplied back to booking
      await pool.request()
        .input("bookingId", sql.Int, bookingId)
        .input("referralDiscount", sql.Decimal(10, 2), referralDiscountApplied)
        .input("creditApplied", sql.Decimal(10, 2), creditApplied)
        .query(`
          UPDATE Bookings 
          SET referralDiscount = @referralDiscount,
              creditApplied = @creditApplied
          WHERE id = @bookingId
        `);
    }

    if (finalPrice === 0) {
      const freeOrderId = "order_free_" + Math.random().toString(36).substring(2, 11);
      await logPayment(pool, userId, 0, planId, freeOrderId, null, 'pending');
      return response.json({
        id: freeOrderId,
        amount: 0,
        currency: "INR",
        isMock: true,
        isFree: true,
        key: "rzp_test_mockkey",
        planId,
        billingCycle,
        referralDiscount: referralDiscountApplied,
        creditApplied,
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const isRazorpayConfigured = keyId && keyId.trim() && keySecret && keySecret.trim();

    if (!isRazorpayConfigured) {
      // Return a Mock Order for developer testing
      const mockOrderId = "order_mock_" + Math.random().toString(36).substring(2, 11);
      await logPayment(pool, userId, finalPrice, planId, mockOrderId, null, 'pending');
      return response.json({
        id: mockOrderId,
        amount: Math.round(finalPrice * 100),
        currency: "INR",
        isMock: true,
        key: "rzp_test_mockkey",
        planId,
        billingCycle,
        referralDiscount: referralDiscountApplied,
        creditApplied,
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
        amount: Math.round(finalPrice * 100),
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

    await logPayment(pool, userId, finalPrice, planId, orderData.id, null, 'pending');

    return response.json({
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      isMock: false,
      key: keyId,
      planId,
      billingCycle,
      referralDiscount: referralDiscountApplied,
      creditApplied,
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
      if (keyId && keyId.trim() && !String(razorpay_order_id).startsWith("order_free_")) {
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

      let amountVal = 0;
      if (planId === "Pro") amountVal = 999.00;
      else if (planId === "Plus") amountVal = 299.00;
      else if (planId === "Alterations") amountVal = 499.00;

      await logPayment(pool, userId, amountVal, planId, razorpay_order_id, razorpay_payment_id || "mock_payment", "verified");

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

    let amountVal = 0;
    if (planId === "Pro") amountVal = 999.00;
    else if (planId === "Plus") amountVal = 299.00;
    else if (planId === "Alterations") amountVal = 499.00;

    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      await logPayment(pool, userId, amountVal, planId, razorpay_order_id, razorpay_payment_id, "failed");
      return response.status(400).json({
        message: "Invalid payment signature. Payment verification failed.",
      });
    }

    await logPayment(pool, userId, amountVal, planId, razorpay_order_id, razorpay_payment_id, "verified");

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
    try {
      const pool = await getSqlPool();
      await logPayment(pool, request.body.userId || 0, 0, request.body.planId || "unknown", request.body.razorpay_order_id || "unknown", request.body.razorpay_payment_id || "unknown", "failed");
    } catch (e) {
      console.error("Failed to log failed payment error:", e);
    }
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

    await logPayment(pool, userId, 0, planToActivate, "free_" + Date.now(), "free_activation", "verified");

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

    if (status === "booked" && existingBooking.status === "pending-payment") {
      const bookingDetailsRes = await pool.request()
        .input("bookingId", sql.Int, bookingId)
        .query("SELECT userId, referralDiscount, creditApplied FROM Bookings WHERE id = @bookingId");
      const bd = bookingDetailsRes.recordset[0];
      if (bd) {
        const userId = bd.userId;
        const creditApplied = Number(bd.creditApplied || 0);

        if (creditApplied > 0) {
          await pool.request()
            .input("userId", sql.Int, userId)
            .input("creditApplied", sql.Decimal(10, 2), creditApplied)
            .query(`
              UPDATE Users 
              SET credit = CASE WHEN credit >= @creditApplied THEN credit - @creditApplied ELSE 0 END 
              WHERE id = @userId
            `);
        }

        // Check if there is a pending referral reward
        const referralRes = await pool.request()
          .input("userId", sql.Int, userId)
          .query("SELECT TOP 1 id, referrerUserId, rewardGranted FROM Referrals WHERE referredUserId = @userId");
        const referral = referralRes.recordset[0];
        if (referral && !referral.rewardGranted) {
          const bookedCountResult = await pool.request()
            .input("userId", sql.Int, userId)
            .input("bookingId", sql.Int, bookingId)
            .query(`
              SELECT COUNT(id) AS cnt 
              FROM Bookings 
              WHERE userId = @userId 
                AND status IN ('booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered')
                AND id <> @bookingId
            `);
          if (bookedCountResult.recordset[0].cnt === 0) {
            await pool.request()
              .input("referralId", sql.Int, referral.id)
              .query("UPDATE Referrals SET rewardGranted = 1 WHERE id = @referralId");

            await pool.request()
              .input("referrerId", sql.Int, referral.referrerUserId)
              .query("UPDATE Users SET credit = credit + 50.00 WHERE id = @referrerId");
          }
        }
      }
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

    const pool = await getSqlPool();
    await ensureReviewsTable(pool);

    // Retrieve booking to verify ownership, status, and tailor details
    const bookingResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .query(`
        SELECT TOP 1 userId, status, tailorApplicationId 
        FROM Bookings 
        WHERE id = @bookingId
      `);
    const booking = bookingResult.recordset[0];

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

    // Check if review already exists
    const existingResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .query(`
        SELECT TOP 1 id FROM Reviews WHERE bookingId = @bookingId
      `);
    if (existingResult.recordset.length > 0) {
      return response.status(400).json({
        message: "You have already reviewed this booking",
      });
    }

    // Insert the review
    const insertResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .input("userId", sql.Int, userId)
      .input("tailorApplicationId", sql.Int, booking.tailorApplicationId)
      .input("rating", sql.Int, ratingNum)
      .input("comment", sql.NVarChar(500), comment ? String(comment).slice(0, 500) : null)
      .query(`
        INSERT INTO Reviews (bookingId, userId, tailorApplicationId, rating, comment)
        OUTPUT INSERTED.id
        VALUES (@bookingId, @userId, @tailorApplicationId, @rating, @comment)
      `);

    return response.status(201).json({
      message: "Review submitted successfully",
      reviewId: insertResult.recordset[0].id,
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

    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    let tailorName = null;
    let tailorEmail = null;
    let tailorPhoneNumber = null;

    if (tailorApplicationId) {
      const tailorRes = await pool.request()
        .input("tailorId", sql.Int, Number(tailorApplicationId))
        .query("SELECT firstName + ' ' + lastName AS fullName, email, phoneNumber FROM JoinApplications WHERE id = @tailorId");
      if (tailorRes.recordset.length > 0) {
        const t = tailorRes.recordset[0];
        tailorName = t.fullName;
        tailorEmail = t.email;
        tailorPhoneNumber = t.phoneNumber;
      }
    }

    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("companyName", sql.NVarChar(255), companyName)
      .input("contactName", sql.NVarChar(150), contactName)
      .input("email", sql.NVarChar(255), email)
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("businessType", sql.NVarChar(100), businessType)
      .input("quantity", sql.Int, quantityNum)
      .input("requirements", sql.NVarChar(sql.MAX), requirements || null)
      .input("targetDeliveryDate", sql.Date, targetDeliveryDate ? new Date(targetDeliveryDate) : null)
      .input("location", sql.NVarChar(255), location || null)
      .input("tailorApplicationId", sql.Int, tailorApplicationId ? Number(tailorApplicationId) : null)
      .input("tailorName", sql.NVarChar(200), tailorName)
      .input("tailorEmail", sql.NVarChar(255), tailorEmail)
      .input("tailorPhoneNumber", sql.NVarChar(20), tailorPhoneNumber)
      .query(`
        INSERT INTO BusinessOrders (userId, companyName, contactName, email, phoneNumber, businessType, quantity, requirements, targetDeliveryDate, location, tailorApplicationId, tailorName, tailorEmail, tailorPhoneNumber, status)
        OUTPUT INSERTED.id, INSERTED.userId, INSERTED.companyName, INSERTED.contactName, INSERTED.email, INSERTED.phoneNumber, INSERTED.businessType, INSERTED.quantity, INSERTED.requirements, INSERTED.approxPrice, INSERTED.status, INSERTED.targetDeliveryDate, INSERTED.location, INSERTED.tailorApplicationId, INSERTED.tailorName, INSERTED.tailorEmail, INSERTED.tailorPhoneNumber, INSERTED.createdAt
        VALUES (@userId, @companyName, @contactName, @email, @phoneNumber, @businessType, @quantity, @requirements, @targetDeliveryDate, @location, @tailorApplicationId, @tailorName, @tailorEmail, @tailorPhoneNumber, 'pending')
      `);

    return response.status(201).json({
      message: "Business order inquiry submitted successfully",
      businessOrder: result.recordset[0],
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
    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    let result;
    if (userRole === "tailor") {
      // Tailors see all bulk inquiries
      result = await pool.request().query(`
        SELECT bo.id, bo.userId, bo.companyName, bo.contactName, bo.email, bo.phoneNumber, bo.businessType, bo.quantity, bo.requirements, bo.approxPrice, bo.status, bo.targetDeliveryDate, bo.location, bo.tailorApplicationId, bo.tailorName, bo.tailorEmail, bo.tailorPhoneNumber, bo.createdAt, bo.deliveredAt, u.fullName AS userFullName
        FROM BusinessOrders bo
        LEFT JOIN Users u ON u.id = bo.userId
        ORDER BY bo.createdAt DESC
      `);
    } else {
      // Normal customers see only their own bulk inquiries
      result = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT bo.id, bo.userId, bo.companyName, bo.contactName, bo.email, bo.phoneNumber, bo.businessType, bo.quantity, bo.requirements, bo.approxPrice, bo.status, bo.targetDeliveryDate, bo.location, bo.tailorApplicationId, bo.tailorName, bo.tailorEmail, bo.tailorPhoneNumber, bo.createdAt, bo.deliveredAt
          FROM BusinessOrders bo
          WHERE bo.userId = @userId
          ORDER BY bo.createdAt DESC
        `);
    }

    return response.json({
      businessOrders: result.recordset,
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
    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    const result = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT bo.id, bo.userId, bo.companyName, bo.contactName, bo.email, bo.phoneNumber, bo.businessType, bo.quantity, bo.requirements, bo.approxPrice, bo.status, bo.targetDeliveryDate, bo.location, bo.tailorApplicationId, bo.tailorName, bo.tailorEmail, bo.tailorPhoneNumber, bo.createdAt, bo.deliveredAt, u.fullName AS userFullName
        FROM BusinessOrders bo
        LEFT JOIN Users u ON u.id = bo.userId
        WHERE bo.id = @orderId
      `);

    const order = result.recordset[0];
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

    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    const result = await pool.request()
      .input("orderId", sql.Int, orderId)
      .input("approxPrice", sql.Decimal(10, 2), priceNum)
      .query(`
        UPDATE BusinessOrders
        SET approxPrice = @approxPrice,
            status = 'quoted'
        OUTPUT INSERTED.id, INSERTED.approxPrice, INSERTED.status
        WHERE id = @orderId
      `);

    if (result.recordset.length === 0) {
      return response.status(404).json({
        message: "Business order not found",
      });
    }

    return response.json({
      message: "Price quote submitted successfully",
      businessOrder: result.recordset[0],
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

    const pool = await getSqlPool();
    await ensureBusinessOrdersTable(pool);

    // If customer, verify ownership
    if (userRole === "user") {
      const checkResult = await pool.request()
        .input("orderId", sql.Int, orderId)
        .query("SELECT userId FROM BusinessOrders WHERE id = @orderId");
      const order = checkResult.recordset[0];
      if (!order) {
        return response.status(404).json({ message: "Business order not found" });
      }
      if (Number(order.userId) !== userId) {
        return response.status(403).json({ message: "You can only update status for your own business orders" });
      }

      // Customer can only mark as 'booked' (confirming quote) or 'cancelled'
      if (status !== "booked" && status !== "cancelled") {
        return response.status(400).json({ message: "Customers can only accept a quote or cancel the request" });
      }
    }

    const result = await pool.request()
      .input("orderId", sql.Int, orderId)
      .input("status", sql.NVarChar(50), status)
      .query(`
        UPDATE BusinessOrders
        SET status = @status,
            deliveredAt = CASE WHEN @status = 'delivered' THEN SYSUTCDATETIME() ELSE deliveredAt END
        OUTPUT INSERTED.id, INSERTED.status, INSERTED.deliveredAt
        WHERE id = @orderId
      `);

    return response.json({
      message: "Business order status updated successfully",
      businessOrder: result.recordset[0],
    });
  } catch (error) {
    console.error("Update business status error:", error);
    return response.status(500).json({
      message: "Unable to update status",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
