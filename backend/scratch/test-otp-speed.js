require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");
const User = require("../models/User");
const LoginOtp = require("../models/LoginOtp");
const { generateOtp, sendOtpEmail } = require("../utils/otp");

async function runTest() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const email = "otp-speed-test@example.com";
    
    // Ensure test user exists
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        fullName: "Speed Tester",
        passwordHash: "dummyhash",
        isBanned: false
      });
      await user.save();
      console.log("Created speed test user.");
    }

    // Clean up existing OTPs for the user
    await LoginOtp.deleteMany({ email });

    console.log("\n--- Testing Single OTP Request ---");
    const start1 = Date.now();
    const otpCode1 = generateOtp();
    const loginOtp1 = new LoginOtp({
      email,
      otpCode: otpCode1,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    const [, emailResult1] = await Promise.all([
      loginOtp1.save(),
      sendOtpEmail(user.email, user.fullName, otpCode1)
    ]);
    const duration1 = Date.now() - start1;
    console.log(`First OTP request took ${duration1}ms`);
    console.log("Email Result:", emailResult1);

    console.log("\n--- Testing Second OTP Request (reuses transporter) ---");
    const start2 = Date.now();
    const otpCode2 = generateOtp();
    const loginOtp2 = new LoginOtp({
      email,
      otpCode: otpCode2,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    const [, emailResult2] = await Promise.all([
      loginOtp2.save(),
      sendOtpEmail(user.email, user.fullName, otpCode2)
    ]);
    const duration2 = Date.now() - start2;
    console.log(`Second OTP request took ${duration2}ms`);
    console.log("Email Result:", emailResult2);

    // Clean up
    await LoginOtp.deleteMany({ email });
    await User.deleteOne({ email });
    console.log("\nCleaned up test data.");
    process.exit(0);
  } catch (err) {
    console.error("Speed test failed:", err);
    process.exit(1);
  }
}

runTest();
