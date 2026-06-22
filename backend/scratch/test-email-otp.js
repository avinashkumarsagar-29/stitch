require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");
const LoginOtp = require("../models/LoginOtp");

async function runTest() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const testEmail = "test-otp-email@example.com";

    // 1. Clean up old test data
    await LoginOtp.deleteMany({ email: testEmail });
    console.log("Cleaned up old test OTPs.");

    // 2. Create new OTP
    const testOtpCode = "123456";
    const otp = new LoginOtp({
      email: testEmail,
      otpCode: testOtpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    await otp.save();
    console.log("Saved test OTP to DB.");

    // 3. Look up active OTP
    let activeOtp = await LoginOtp.findOne({
      email: testEmail,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!activeOtp) {
      throw new Error("Failed to find active OTP!");
    }
    console.log("Successfully found active OTP in DB.");

    // 4. Test wrong OTP attempt
    console.log("Testing wrong OTP code...");
    if (activeOtp.otpCode !== "wrongcode") {
      activeOtp.attempts += 1;
      await activeOtp.save();
    }
    console.log(`Failed attempts count: ${activeOtp.attempts}`);

    // Re-fetch
    activeOtp = await LoginOtp.findOne({
      email: testEmail,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (activeOtp.attempts !== 1) {
      throw new Error("Attempts counter not working!");
    }
    console.log("Attempts count updated successfully in DB.");

    // 5. Test correct OTP verification
    console.log("Testing correct OTP verification...");
    if (activeOtp.otpCode === testOtpCode) {
      activeOtp.usedAt = new Date();
      await activeOtp.save();
    }

    // Re-fetch
    activeOtp = await LoginOtp.findOne({
      email: testEmail,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (activeOtp) {
      throw new Error("OTP was not marked as used or was found active!");
    }
    console.log("Success! OTP was verified and invalidated correctly.");

    // Clean up
    await LoginOtp.deleteMany({ email: testEmail });
    console.log("Test completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
