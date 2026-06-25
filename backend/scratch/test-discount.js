require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo } = require("../db.mongo");
const User = require("../models/User");
const Discount = require("../models/Discount");
const { checkFirstOrderDiscount, markFirstOrderDiscountUsed } = require("../utils/discount");

async function runTest() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const email = "discount-test-user@example.com";

    // 1. Create test user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        fullName: "Discount Tester",
        passwordHash: "dummyhash",
        isBanned: false
      });
      await user.save();
      console.log(`Created test user with ID: ${user.id}`);
    } else {
      console.log(`Using existing test user with ID: ${user.id}`);
    }

    const userId = user.id;

    // 2. Clean up discount entry
    await Discount.deleteMany({ userId });
    console.log("Cleaned up old discount entries.");

    // 3. Test first-time check (should be eligible)
    console.log("Testing initial discount check...");
    const check1 = await checkFirstOrderDiscount(userId);
    console.log("Check 1 Result:", check1);

    if (!check1.eligible || check1.percent !== 20 || check1.minOrder !== 300) {
      throw new Error("Initial discount check failed! User should be eligible.");
    }
    console.log("✓ Initial discount check passed.");

    // 4. Test mark used
    console.log("Marking discount as used...");
    await markFirstOrderDiscountUsed(userId);

    // Verify entry in database
    const dbEntry = await Discount.findOne({ userId });
    console.log("Database entry:", dbEntry);
    if (!dbEntry || !dbEntry.firstOrderDiscountUsed || !dbEntry.usedAt) {
      throw new Error("Discount mark used failed! Database entry not correctly updated.");
    }
    console.log("✓ Discount correctly marked as used in DB.");

    // 5. Test second-time check (should not be eligible)
    console.log("Testing subsequent discount check...");
    const check2 = await checkFirstOrderDiscount(userId);
    console.log("Check 2 Result:", check2);

    if (check2.eligible) {
      throw new Error("Subsequent discount check failed! User should NOT be eligible.");
    }
    console.log("✓ Subsequent discount check passed.");

    // 6. Clean up test data
    await Discount.deleteMany({ userId });
    await User.deleteOne({ id: userId });
    console.log("Cleaned up test user and discount entries.");

    console.log("\nSuccess! First Order Discount Logic verified end-to-end.");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
