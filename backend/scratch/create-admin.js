require("dotenv").config();
const mongoose = require("mongoose");
const { connectMongo } = require("../db.mongo");
const User = require("../models/User");

async function run() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const email = "avikumarsagar9@gmail.com";
    let user = await User.findOne({ email });

    if (user) {
      console.log(`User ${email} already exists. Promoting to admin...`);
      user.role = "admin";
      await user.save();
    } else {
      console.log(`User ${email} does not exist. Creating new admin user...`);
      
      // Generate a simple referral code
      const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
      const referralCode = `STITCH-${randomChars}`;

      user = new User({
        fullName: "Avi Kumar Sagar",
        firstName: "Avi",
        lastName: "Kumar Sagar",
        email: email,
        role: "admin",
        plan: "Free",
        referralCode: referralCode,
        credit: 0,
      });

      await user.save();
    }

    console.log("\nAdmin User Configured Successfully:");
    console.log("ID:", user._id);
    console.log("Name:", user.fullName);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Referral Code:", user.referralCode);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    mongoose.connection.close();
  }
}

run();
