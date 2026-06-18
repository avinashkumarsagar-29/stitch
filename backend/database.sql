IF DB_ID('stitch') IS NULL
BEGIN
  CREATE DATABASE stitch;
END
GO

USE stitch;
GO

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
GO

IF COL_LENGTH('dbo.Users', 'role') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD role NVARCHAR(50) NOT NULL DEFAULT 'user';
END
GO

IF COL_LENGTH('dbo.Users', 'firstName') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD firstName NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'lastName') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD lastName NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'address') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD address NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'image') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD image NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'isBanned') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD isBanned BIT NOT NULL DEFAULT 0;
END
GO

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
GO

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
GO

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
GO

IF COL_LENGTH('dbo.Bookings', 'tailorApplicationId') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD tailorApplicationId INT NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'tailorName') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD tailorName NVARCHAR(201) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'tailorEmail') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD tailorEmail NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'tailorPhoneNumber') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD tailorPhoneNumber NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'clothCategory') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD clothCategory NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'clothImage') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD clothImage NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'material') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD material NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'approxPrice') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD approxPrice DECIMAL(10,2) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'trackingCode') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD trackingCode NVARCHAR(10) NULL;
END
GO

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
GO

IF COL_LENGTH('dbo.JoinApplications', 'email') IS NULL
BEGIN
  ALTER TABLE dbo.JoinApplications ADD email NVARCHAR(255) NOT NULL DEFAULT '';
END
GO

IF COL_LENGTH('dbo.JoinApplications', 'phoneNumber') IS NULL
BEGIN
  ALTER TABLE dbo.JoinApplications ADD phoneNumber NVARCHAR(20) NOT NULL DEFAULT '';
END
GO

IF COL_LENGTH('dbo.JoinApplications', 'rejectionReason') IS NULL
BEGIN
  ALTER TABLE dbo.JoinApplications ADD rejectionReason NVARCHAR(500) NULL;
END
GO

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
    height DECIMAL(5,2),
    sleeve DECIMAL(5,2),
    updatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Measurements_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
  );
END
GO

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
GO

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
GO

IF COL_LENGTH('dbo.Users', 'referralCode') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD referralCode NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'credit') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD credit DECIMAL(10,2) NOT NULL DEFAULT 0.00;
END
GO

IF COL_LENGTH('dbo.Bookings', 'referralDiscount') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD referralDiscount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
END
GO

IF COL_LENGTH('dbo.Bookings', 'creditApplied') IS NULL
BEGIN
  ALTER TABLE dbo.Bookings ADD creditApplied DECIMAL(10,2) NOT NULL DEFAULT 0.00;
END
GO

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
GO

IF COL_LENGTH('dbo.BusinessOrders', 'deliveredAt') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD deliveredAt DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'targetDeliveryDate') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD targetDeliveryDate DATE NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'location') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD location NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'tailorApplicationId') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD tailorApplicationId INT NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'tailorName') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD tailorName NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'tailorEmail') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD tailorEmail NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.BusinessOrders', 'tailorPhoneNumber') IS NULL
BEGIN
  ALTER TABLE dbo.BusinessOrders ADD tailorPhoneNumber NVARCHAR(20) NULL;
END
GO

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
GO


SELECT * FROM dbo.Users ORDER BY createdAt DESC;
SELECT * FROM dbo.LoginOtps ORDER BY createdAt DESC;
SELECT * FROM dbo.Bookings ORDER BY createdAt DESC;
SELECT * FROM dbo.JoinApplications ORDER BY createdAt DESC;
IF OBJECT_ID('dbo.Measurements', 'U') IS NOT NULL
BEGIN
  SELECT * FROM dbo.Measurements ORDER BY updatedAt DESC;
END
GO

-- =========================================================================
-- ADMIN UTILITIES
-- =========================================================================
-- Note: Registration only allows 'user' or 'tailor'. 
-- To test the Admin Dashboard, register a normal account first,
-- then promote that user account using the queries below:
--
-- UPDATE Users SET role = 'admin' WHERE email = 'your-registered-email@example.com';
-- OR
-- UPDATE Users SET role = 'admin' WHERE phoneNumber = 'your-registered-phone-number';
-- =========================================================================

