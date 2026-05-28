require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const { getSqlPool, sql } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const otpExpiryMinutes = 5;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);
app.use(express.json());
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
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Bookings_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
      );
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
        experience NVARCHAR(50) NOT NULL,
        location NVARCHAR(255) NOT NULL,
        image NVARCHAR(MAX) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
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
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email, INSERTED.phoneNumber, INSERTED.role
        VALUES (@fullName, @email, @phoneNumber, @passwordHash, @role)
      `);

    return response.status(201).json({
      message: "Registration successful",
      user: result.recordset[0],
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

    return response.json({
      message: "OTP sent successfully",
      devOtp: otpCode,
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
        SELECT id, fullName, email, phoneNumber, role
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
          INSERTED.status,
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
        b.status,
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

app.post("/api/join", async (request, response) => {
  try {
    const firstName = String(request.body.firstName || "").trim();
    const lastName = String(request.body.lastName || "").trim();
    const experience = String(request.body.experience || "").trim();
    const location = String(request.body.location || "").trim();
    const image = request.body.image || null;

    if (!firstName || !lastName || !experience || !location) {
      return response.status(400).json({
        message: "First name, last name, experience, and location are required",
      });
    }

    const pool = await getSqlPool();
    await ensureJoinTable(pool);

    const result = await pool
      .request()
      .input("firstName", sql.NVarChar(100), firstName)
      .input("lastName", sql.NVarChar(100), lastName)
      .input("experience", sql.NVarChar(50), experience)
      .input("location", sql.NVarChar(255), location)
      .input("image", sql.NVarChar(sql.MAX), image)
      .query(`
        INSERT INTO JoinApplications (
          firstName,
          lastName,
          experience,
          location,
          image
        )
        OUTPUT
          INSERTED.id,
          INSERTED.firstName,
          INSERTED.lastName,
          INSERTED.experience,
          INSERTED.location,
          INSERTED.status,
          INSERTED.createdAt
        VALUES (
          @firstName,
          @lastName,
          @experience,
          @location,
          @image
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
        experience,
        location,
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

app.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
