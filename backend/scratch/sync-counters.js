require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");
const { Counter } = require("../models/Counter");

// Import all models to ensure they register their schemas
const User = require("../models/User");
const Booking = require("../models/Booking");
const Measurement = require("../models/Measurement");
const Review = require("../models/Review");
const Referral = require("../models/Referral");
const JoinApplication = require("../models/JoinApplication");
const BusinessOrder = require("../models/BusinessOrder");
const Payment = require("../models/Payment");
const LoginOtp = require("../models/LoginOtp");

const countersToSync = [
  { model: User, sequenceName: "userId" },
  { model: Booking, sequenceName: "bookingId" },
  { model: Measurement, sequenceName: "measurementId" },
  { model: Review, sequenceName: "reviewId" },
  { model: Referral, sequenceName: "referralId" },
  { model: JoinApplication, sequenceName: "joinApplicationId" },
  { model: BusinessOrder, sequenceName: "businessOrderId" },
  { model: Payment, sequenceName: "paymentId" },
  { model: LoginOtp, sequenceName: "loginOtpId" },
];

async function sync() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    for (const item of countersToSync) {
      const maxDoc = await item.model.findOne().sort({ _id: -1 }).exec();
      const maxId = maxDoc && typeof maxDoc._id === "number" ? maxDoc._id : 0;
      
      console.log(`Checking sequence for "${item.sequenceName}":`);
      console.log(`  - Max ID in collection: ${maxId}`);

      const counterDoc = await Counter.findById(item.sequenceName);
      const currentSeq = counterDoc ? counterDoc.seq : 0;
      console.log(`  - Current sequence in Counter: ${currentSeq}`);

      if (currentSeq < maxId) {
        console.log(`  - Updating sequence to ${maxId}...`);
        await Counter.findByIdAndUpdate(
          item.sequenceName,
          { seq: maxId },
          { upsert: true }
        );
        console.log(`  - Successfully updated "${item.sequenceName}" sequence to ${maxId}.`);
      } else {
        console.log(`  - Sequence is up to date (${currentSeq} >= ${maxId}).`);
      }
    }

    console.log("\nAll counters synced successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

sync();
