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
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF COL_LENGTH('dbo.Users', 'phoneNumber') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD phoneNumber NVARCHAR(20) NULL;
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
    status NVARCHAR(50) NOT NULL DEFAULT 'pending',
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Bookings_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
  );
END
GO

SELECT * FROM dbo.Users ORDER BY createdAt DESC;
SELECT * FROM dbo.LoginOtps ORDER BY createdAt DESC;
SELECT * FROM dbo.Bookings ORDER BY createdAt DESC;
GO
