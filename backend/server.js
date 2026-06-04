require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
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
    IF OBJECT_ID('dbo.LoginOtps', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.LoginOtps (
        id INT IDENTITY(1,1) PRIMARY KEY,
        phoneNumber NVARCHAR(20) NOT NULL,
        otpCode NVARCHAR(6) NOT NULL,
        expiresAt DATETIME2 NOT NULL,
        usedAt DATETIME2 NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
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
          <td style="padding: 6px 0; color: #1f2937;">${
            booking.bookingTime instanceof Date
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
    const otpResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .input("otpCode", sql.NVarChar(6), otpCode)
      .query(`
        SELECT TOP 1 id
        FROM LoginOtps
        WHERE phoneNumber = @phoneNumber
          AND otpCode = @otpCode
          AND usedAt IS NULL
          AND expiresAt > SYSUTCDATETIME()
        ORDER BY createdAt DESC
      `);

    const otp = otpResult.recordset[0];

    if (!otp) {
      return response.status(401).json({
        message: "Invalid or expired OTP",
      });
    }

    await pool
      .request()
      .input("id", sql.Int, otp.id)
      .query("UPDATE LoginOtps SET usedAt = SYSUTCDATETIME() WHERE id = @id");

    const userResult = await pool
      .request()
      .input("phoneNumber", sql.NVarChar(20), phoneNumber)
      .query(`
        SELECT id, fullName, email, phoneNumber, role, [plan]
        FROM Users
        WHERE phoneNumber = @phoneNumber
      `);

    const user = userResult.recordset[0];

    return response.json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        plan: user.plan || "Free",
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

app.post("/api/bookings", async (request, response) => {
  try {
    const userId = request.body.userId ? Number(request.body.userId) : null;
    const pickupLocation = String(request.body.pickupLocation || "").trim();
    const dropoffLocation = String(request.body.dropoffLocation || "").trim();
    const bookingDate = String(request.body.bookingDate || "").trim();
    const bookingTime = String(request.body.bookingTime || "").trim();

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

app.get("/api/bookings", async (_request, response) => {
  try {
    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    const result = await pool.request().query(`
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
        b.createdAt
      FROM Bookings b
      LEFT JOIN Users u ON u.id = b.userId
      ORDER BY b.createdAt DESC
    `);

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
          b.createdAt
        FROM Bookings b
        LEFT JOIN Users u ON u.id = b.userId
        WHERE b.id = @bookingIdNum OR b.trackingCode = @bookingIdStr
      `);
    const booking = result.recordset[0];

    if (!booking) {
      return response.status(404).json({
        message: "Booking not found",
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
    const approxPrice = Number(request.body.approxPrice);
    const clothImage = request.body.clothImage || null;

    if (!bookingId || !tailorApplicationId) {
      return response.status(400).json({
        message: "Booking id and tailor id are required",
      });
    }

    if (!clothCategory || !material || !Number.isFinite(approxPrice) || approxPrice <= 0) {
      return response.status(400).json({
        message: "Cloth category, material, and approximate price are required",
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

    const trackingCode = existingBooking.trackingCode || String(Math.floor(1000000 + Math.random() * 9000000));
    const userEmail = existingBooking.userEmail || "";

    const tailorResult = await pool
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
    const tailor = tailorResult.recordset[0];

    if (!tailor) {
      return response.status(404).json({
        message: "Tailor not found",
      });
    }

    const bookingResult = await pool
      .request()
      .input("bookingId", sql.Int, bookingId)
      .input("clothCategory", sql.NVarChar(100), clothCategory)
      .input("clothImage", sql.NVarChar(sql.MAX), clothImage)
      .input("material", sql.NVarChar(100), material)
      .input("approxPrice", sql.Decimal(10, 2), approxPrice)
      .input("trackingCode", sql.NVarChar(10), trackingCode)
      .query(`
        UPDATE Bookings
        SET
          clothCategory = @clothCategory,
          clothImage = @clothImage,
          material = @material,
          approxPrice = @approxPrice,
          trackingCode = @trackingCode,
          status = 'pending'
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

    // Send email confirmation in background
    if (userEmail) {
      sendBookingEmail(userEmail, booking).catch((err) => {
        console.error("Failed to send booking email:", err);
      });
    } else {
      console.log(`Booking #${bookingId} has no registered user email associated. Email notification skipped.`);
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);
    await ensureJoinTable(pool);

    const tailorResult = await pool
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
    const tailor = tailorResult.recordset[0];

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

    return response.status(201).json({
      message: "Application submitted successfully",
      application: result.recordset[0],
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

app.get("/api/join", async (_request, response) => {
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
    const tailor = result.recordset[0];

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

    const pool = await getSqlPool();

    if (isMock) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      if (keyId && keyId.trim()) {
        return response.status(400).json({
          message: "Mock payments are disabled because real Razorpay keys are configured",
        });
      }

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

      return response.json({
        success: true,
        message: "Mock payment verified and subscription activated",
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

    return response.json({
      success: true,
      message: "Payment verified and subscription activated successfully",
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

    const pool = await getSqlPool();
    await ensureBookingsTable(pool);

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

app.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
