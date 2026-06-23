require("dotenv").config();
const http = require("http");
const io = require("socket.io-client");
const { connectMongo, mongoose } = require("../db.mongo");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { createAuthToken } = require("../utils/jwt");

const SERVER_URL = "http://localhost:4000";

async function runTest() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    // 1. Find the existing super admin user
    let adminUser = await User.findOne({ email: "avikumarsagar9@gmail.com" });
    if (!adminUser) {
      throw new Error("Super admin user avikumarsagar9@gmail.com not found in database!");
    }
    console.log("Found existing super admin user ID:", adminUser._id);

    // 2. Create a test booking
    const lastBooking = await Booking.findOne().sort({ _id: -1 });
    const nextBookingId = lastBooking && typeof lastBooking._id === "number" ? lastBooking._id + 1 : 9100;
    
    const booking = new Booking({
      _id: nextBookingId,
      userId: adminUser._id,
      clothCategory: "Shirt",
      pickupLocation: "Test Address",
      dropoffLocation: "Test Address",
      bookingDate: "2026-06-25",
      bookingTime: "10:00 AM",
      status: "pending"
    });
    await booking.save();
    console.log("Created test booking with ID:", booking._id);

    // 3. Generate Auth Token for admin user
    const token = createAuthToken(adminUser);

    // 4. Connect Socket.IO client and join booking room
    const socket = io(SERVER_URL);
    let statusChangedEventReceived = false;

    await new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log("Socket client connected to test server.");
        socket.emit("join-booking", booking._id);
        
        socket.on("booking:status-changed", (data) => {
          console.log("Socket client received booking:status-changed event:", data);
          if (data.bookingId === booking._id && data.status === "ready") {
            statusChangedEventReceived = true;
          }
        });
        
        resolve();
      });
      
      socket.on("connect_error", (err) => {
        reject(err);
      });
    });

    // Wait slightly to ensure socket room join is registered on server
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 5. Send PATCH request to admin status override route
    console.log("Sending PATCH request to update booking status via admin route...");
    const patchData = JSON.stringify({ status: "ready" });
    
    await new Promise((resolve, reject) => {
      const req = http.request(
        `${SERVER_URL}/api/admin/bookings/${booking._id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(patchData),
            "Authorization": `Bearer ${token}`
          }
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => body += chunk);
          res.on("end", () => {
            console.log(`API response (status ${res.statusCode}):`, body);
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`API responded with status ${res.statusCode}: ${body}`));
            }
          });
        }
      );
      req.on("error", (err) => reject(err));
      req.write(patchData);
      req.end();
    });

    // 6. Wait to receive Socket event
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 7. Cleanup test data
    console.log("Cleaning up database test data...");
    await Booking.deleteOne({ _id: booking._id });

    socket.disconnect();

    console.log("\n--- Verification Result ---");
    console.log("booking:status-changed Socket Event Received (Admin Route):", statusChangedEventReceived ? "PASS" : "FAIL");

    if (statusChangedEventReceived) {
      console.log("\nADMIN BOOKING STATUS SOCKET EMIT VERIFICATION PASSED!");
      process.exit(0);
    } else {
      console.error("\nADMIN BOOKING STATUS SOCKET EMIT VERIFICATION FAILED!");
      process.exit(1);
    }

  } catch (error) {
    console.error("Test error:", error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

runTest();
