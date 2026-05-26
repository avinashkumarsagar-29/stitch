IF DB_ID('stitch') IS NULL
BEGIN
  CREATE DATABASE stitch;
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

SELECT * FROM dbo.Bookings ORDER BY createdAt DESC;
GO

USE stitch;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    fullName NVARCHAR(150) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    passwordHash NVARCHAR(255) NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO
