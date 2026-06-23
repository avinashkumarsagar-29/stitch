require("dotenv").config();
const { connectMongo, mongoose } = require("../db.mongo");
const Booking = require("../models/Booking");

async function check() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const bookings = await Booking.find();
    console.log("\n--- Bookings ---");
    bookings.forEach(b => {
      console.log(`Booking ID: ${b._id}, Customer ID: ${b.userId}, Tailor ID: ${b.tailorApplicationId}, Tailor Name: ${b.tailorName}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Check failed:", error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
}

check();
