require("dotenv").config();
const mongoose = require("mongoose");
const { connectMongo } = require("../db.mongo");
const User = require("../models/User");

async function checkUser() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    const emailToSearch = "avikumarsagar9@gmail.com";
    const user = await User.findOne({ email: emailToSearch });

    if (user) {
      console.log("\nUser Found:");
      console.log("ID:", user._id);
      console.log("Name:", user.fullName);
      console.log("Email:", user.email);
      console.log("Role:", user.role);
      console.log("Is Banned:", user.isBanned);
    } else {
      console.log(`\nUser with email "${emailToSearch}" was NOT found in the database.`);
      const allUsers = await User.find({}, "fullName email role");
      console.log("\nHere is a list of all registered users in the database:");
      allUsers.forEach((u) => {
        console.log(`- ${u.fullName} (${u.email}) [Role: ${u.role}]`);
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

checkUser();
