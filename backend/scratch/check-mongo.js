require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Measurement = require("../models/Measurement");
const Counter = require("../models/Counter");

async function check() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB Atlas.");

    const usersCount = await User.countDocuments();
    const bookingsCount = await Booking.countDocuments();
    const measurementsCount = await Measurement.countDocuments();
    const countersCount = await Counter.Counter.countDocuments();

    console.log(`Users count: ${usersCount}`);
    console.log(`Bookings count: ${bookingsCount}`);
    console.log(`Measurements count: ${measurementsCount}`);
    console.log(`Counters count: ${countersCount}`);

    console.log("\nSample Users:");
    const sampleUsers = await User.find().limit(3);
    console.log(JSON.stringify(sampleUsers, null, 2));

    console.log("\nSample Bookings:");
    const sampleBookings = await Booking.find().limit(3);
    console.log(JSON.stringify(sampleBookings, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Check failed:", err);
    process.exit(1);
  }
}

check();
