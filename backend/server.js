require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const { getSqlPool, sql } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    name: "Stitch backend",
    status: "running",
    endpoints: {
      health: "/health",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
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

app.post("/api/auth/register", async (request, response) => {
  try {
    const fullName = String(request.body.fullName || "").trim();
    const email = String(request.body.email || "").trim().toLowerCase();
    const password = String(request.body.password || "");

    if (!fullName || !email || !password) {
      return response.status(400).json({
        message: "Full name, email and password are required",
      });
    }

    if (password.length < 6) {
      return response.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const pool = await getSqlPool();
    const existingUser = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .query("SELECT id FROM Users WHERE email = @email");

    if (existingUser.recordset.length > 0) {
      return response.status(409).json({
        message: "Email is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool
      .request()
      .input("fullName", sql.NVarChar(150), fullName)
      .input("email", sql.NVarChar(255), email)
      .input("passwordHash", sql.NVarChar(255), passwordHash)
      .query(`
        INSERT INTO Users (fullName, email, passwordHash)
        OUTPUT INSERTED.id, INSERTED.fullName, INSERTED.email
        VALUES (@fullName, @email, @passwordHash)
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

app.post("/api/auth/login", async (request, response) => {
  try {
    const email = String(request.body.email || "").trim().toLowerCase();
    const password = String(request.body.password || "");

    if (!email || !password) {
      return response.status(400).json({
        message: "Email and password are required",
      });
    }

    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .query(`
        SELECT id, fullName, email, passwordHash
        FROM Users
        WHERE email = @email
      `);

    const user = result.recordset[0];

    if (!user) {
      return response.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return response.status(401).json({
        message: "Invalid email or password",
      });
    }

    return response.json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
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

app.listen(port, () => {
  console.log(`Stitch backend running at http://localhost:${port}`);
});
