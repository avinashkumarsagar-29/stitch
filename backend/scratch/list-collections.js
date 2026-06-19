require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");

async function check() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB Atlas.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("\nCollections list in database:");
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- Collection name: "${col.name}", Document Count: ${count}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Check failed:", err);
    process.exit(1);
  }
}

check();
