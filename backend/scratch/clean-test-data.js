require("dotenv").config();
const { connectMongo, mongoose } = require("../db.mongo");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { Counter } = require("../models/Counter");

async function cleanup() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    // Delete test bookings
    console.log("Deleting left-over test bookings...");
    const deleteBookingResult = await Booking.deleteMany({
      $or: [
        { _id: 154 },
        { _id: 155 },
        { clothCategory: "Shirt", pickupLocation: "Test Address" }
      ]
    });
    console.log(`Deleted ${deleteBookingResult.deletedCount} test bookings.`);

    // Delete test users
    console.log("Deleting test users...");
    const deleteUserResult = await User.deleteMany({
      email: { $in: ["socket-test-user@example.com", "socket-admin-test-user@example.com"] }
    });
    console.log(`Deleted ${deleteUserResult.deletedCount} test users.`);

    // Re-sync all counters
    const countersToSync = [
      { model: User, sequenceName: "userId" },
      { model: Booking, sequenceName: "bookingId" },
    ];

    for (const item of countersToSync) {
      const maxDoc = await item.model.findOne().sort({ _id: -1 }).exec();
      const maxId = maxDoc && typeof maxDoc._id === "number" ? maxDoc._id : 0;
      
      console.log(`Syncing "${item.sequenceName}":`);
      console.log(`  - Max ID: ${maxId}`);
      
      // Update the counter to be exactly maxId
      await Counter.findByIdAndUpdate(
        item.sequenceName,
        { seq: maxId },
        { upsert: true }
      );
      console.log(`  - Set "${item.sequenceName}" sequence to ${maxId}.`);
    }

    console.log("Cleanup and sync completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

cleanup();
