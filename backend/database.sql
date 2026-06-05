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

SELECT * FROM dbo.Users ORDER BY createdAt DESC;
SELECT * FROM dbo.LoginOtps ORDER BY createdAt DESC;
SELECT * FROM dbo.Bookings ORDER BY createdAt DESC;
SELECT * FROM dbo.JoinApplications ORDER BY createdAt DESC;
GO
