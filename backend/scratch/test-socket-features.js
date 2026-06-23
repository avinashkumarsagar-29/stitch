const io = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";
const BOOKING_ID = 9999;
const TAILOR_ID = 123;

console.log("Starting Socket.IO verification script...");

// 1. Create client socket (representing customer or general listener)
const clientSocket = io(SERVER_URL);

// 2. Create tailor socket (representing tailor)
const tailorSocket = io(SERVER_URL);

let tailorOnlineReceived = false;
let tailorOfflineReceived = false;
let pongReceived = false;

// When client socket connects
clientSocket.on("connect", () => {
  console.log("Client socket connected, joining booking...");
  clientSocket.emit("join-booking", BOOKING_ID);

  // Listen for tailor status events
  clientSocket.on("tailor:status", (data) => {
    console.log("Client received tailor:status event:", data);
    if (data.tailorId === TAILOR_ID) {
      if (data.online === true) {
        tailorOnlineReceived = true;
      } else if (data.online === false) {
        tailorOfflineReceived = true;
      }
    }
  });

  // Listen for pong event
  clientSocket.on("pong:tailor", (data) => {
    console.log("Client received pong:tailor event:", data);
    if (data.alive === true) {
      pongReceived = true;
    }
  });
});

tailorSocket.on("connect", () => {
  console.log("Tailor socket connected.");
  
  // Wait a moment, then emit tailor:online
  setTimeout(() => {
    console.log("Emitting tailor:online...");
    tailorSocket.emit("tailor:online", { tailorId: TAILOR_ID, bookingId: BOOKING_ID });
  }, 500);

  // Emit ping:tailor
  setTimeout(() => {
    console.log("Emitting ping:tailor...");
    tailorSocket.emit("ping:tailor", { bookingId: BOOKING_ID });
  }, 1000);

  // Emit tailor:offline
  setTimeout(() => {
    console.log("Emitting tailor:offline...");
    tailorSocket.emit("tailor:offline", { tailorId: TAILOR_ID, bookingId: BOOKING_ID });
  }, 1500);
});

// Final check and exit
setTimeout(() => {
  console.log("\n--- Verification Results ---");
  console.log("Tailor Online Broadcast Received:", tailorOnlineReceived ? "PASS" : "FAIL");
  console.log("Tailor Offline Broadcast Received:", tailorOfflineReceived ? "PASS" : "FAIL");
  console.log("Ping-Pong Heartbeat Received:", pongReceived ? "PASS" : "FAIL");
  
  clientSocket.disconnect();
  tailorSocket.disconnect();

  if (tailorOnlineReceived && tailorOfflineReceived && pongReceived) {
    console.log("\nALL SOCKET.IO EVENT VERIFICATIONS PASSED!");
    process.exit(0);
  } else {
    console.error("\nSOME VERIFICATIONS FAILED!");
    process.exit(1);
  }
}, 3000);
