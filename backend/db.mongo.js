const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function connectMongo() {
  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000, // Wait up to 10s for server selection
    socketTimeoutMS: 90000,          // Wait up to 90s for socket inactivity
    connectTimeoutMS: 30000,         // Wait up to 30s to establish initial connection
  };

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(MONGODB_URI, options);
      console.log("Successfully connected to MongoDB Atlas");
      return;
    } catch (err) {
      console.error(`Failed to connect to MongoDB Atlas (retries left: ${retries - 1}):`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error("Could not establish connection to MongoDB Atlas. Exiting...");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

module.exports = {
  connectMongo,
  mongoose,
};
