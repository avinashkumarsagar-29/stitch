require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { connectMongo, mongoose } = require("../db.mongo");

// Import all models
const User = require("../models/User");
const Booking = require("../models/Booking");
const JoinApplication = require("../models/JoinApplication");

async function runTest() {
  try {
    await connectMongo();
    console.log("Connected to MongoDB.");

    // --- ORIGINAL CODE SIMULATION ---
    console.log("Running original logic...");
    const startOrig = Date.now();
    const total = await User.countDocuments();
    const users = await User.countDocuments({ role: "user" });
    const tailors = await User.countDocuments({ role: "tailor" });
    const admins = await User.countDocuments({ role: "admin" });

    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: { $in: ['pending', 'pending-price', 'pending-payment'] } });
    const bookedBookings = await Booking.countDocuments({ status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery'] } });
    const deliveredBookings = await Booking.countDocuments({ status: 'delivered' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

    const activeBookingsForRevenue = await Booking.find({
      status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
    });
    let totalCollected = 0;
    for (const b of activeBookingsForRevenue) {
      const price = Number(b.approxPrice || 0);
      const tax = Math.round(price * 0.18);
      const refDisc = Number(b.referralDiscount || 0);
      const credApp = Number(b.creditApplied || 0);
      const val = price + tax + 49 - refDisc - credApp;
      totalCollected += val < 0 ? 0 : val;
    }

    const totalApps = await JoinApplication.countDocuments();
    const pendingApps = await JoinApplication.countDocuments({ status: "pending" });
    const approvedApps = await JoinApplication.countDocuments({ status: "approved" });
    const rejectedApps = await JoinApplication.countDocuments({ status: "rejected" });

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
    const recentBookingsRaw = await Booking.find().sort({ createdAt: -1 }).limit(5);
    const recentBookings = [];
    for (const b of recentBookingsRaw) {
      const u = await User.findById(b.userId);
      recentBookings.push({
        id: b._id,
        status: b.status,
        approxPrice: b.approxPrice,
        createdAt: b.createdAt,
        fullName: u ? u.fullName : null
      });
    }

    const recentApplications = await JoinApplication.find().sort({ createdAt: -1 }).limit(5);
    const timeOrig = Date.now() - startOrig;

    // --- OPTIMIZED CODE SIMULATION ---
    console.log("Running optimized logic...");
    const startOpt = Date.now();
    const [
      opt_total,
      opt_users,
      opt_tailors,
      opt_admins,
      opt_totalBookings,
      opt_pendingBookings,
      opt_bookedBookings,
      opt_deliveredBookings,
      opt_cancelledBookings,
      opt_totalApps,
      opt_pendingApps,
      opt_approvedApps,
      opt_rejectedApps,
      opt_recentUsers,
      opt_recentBookingsRaw,
      opt_recentApplications,
      revenueAggregation
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "tailor" }),
      User.countDocuments({ role: "admin" }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['pending', 'pending-price', 'pending-payment'] } }),
      Booking.countDocuments({ status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery'] } }),
      Booking.countDocuments({ status: 'delivered' }),
      Booking.countDocuments({ status: 'cancelled' }),
      JoinApplication.countDocuments(),
      JoinApplication.countDocuments({ status: "pending" }),
      JoinApplication.countDocuments({ status: "approved" }),
      JoinApplication.countDocuments({ status: "rejected" }),
      User.find().sort({ createdAt: -1 }).limit(5),
      Booking.find().sort({ createdAt: -1 }).limit(5),
      JoinApplication.find().sort({ createdAt: -1 }).limit(5),
      Booking.aggregate([
        {
          $match: {
            status: { $in: ['booked', 'picked-up', 'in-stitching', 'ready', 'out-for-delivery', 'delivered'] }
          }
        },
        {
          $project: {
            val: {
              $subtract: [
                {
                  $add: [
                    { $ifNull: ["$approxPrice", 0] },
                    { $round: [{ $multiply: [{ $ifNull: ["$approxPrice", 0] }, 0.18] }, 0] },
                    49
                  ]
                },
                {
                  $add: [
                    { $ifNull: ["$referralDiscount", 0] },
                    { $ifNull: ["$creditApplied", 0] }
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalCollected: {
              $sum: {
                $cond: {
                  if: { $lt: ["$val", 0] },
                  then: 0,
                  else: "$val"
                }
              }
            }
          }
        }
      ])
    ]);

    const opt_totalCollected = revenueAggregation[0]?.totalCollected || 0;

    const userIds = [...new Set(opt_recentBookingsRaw.map(b => b.userId).filter(id => id !== null && id !== undefined))];
    const bookingUsers = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(bookingUsers.map(u => [u._id, u]));

    const opt_recentBookings = opt_recentBookingsRaw.map(b => {
      const u = b.userId ? userMap.get(b.userId) : null;
      return {
        id: b._id,
        status: b.status,
        approxPrice: b.approxPrice,
        createdAt: b.createdAt,
        fullName: u ? u.fullName : null
      };
    });
    const timeOpt = Date.now() - startOpt;

    // --- COMPARISON ---
    console.log("\n--- Comparison Results ---");
    console.log(`Original Time: ${timeOrig}ms`);
    console.log(`Optimized Time: ${timeOpt}ms`);
    console.log(`Speedup: ${(timeOrig / timeOpt).toFixed(2)}x`);

    console.log(`\nRevenue:`);
    console.log(`- Original totalCollected: ₹${totalCollected}`);
    console.log(`- Optimized totalCollected: ₹${opt_totalCollected}`);
    if (totalCollected !== opt_totalCollected) {
      console.error("Mismatch in totalCollected!");
    } else {
      console.log("Success! revenue calculations match.");
    }

    console.log(`\nUser counts:`);
    console.log(`- Total: ${total} vs ${opt_total}`);
    console.log(`- Users: ${users} vs ${opt_users}`);
    console.log(`- Tailors: ${tailors} vs ${opt_tailors}`);
    console.log(`- Admins: ${admins} vs ${opt_admins}`);

    console.log(`\nBooking counts:`);
    console.log(`- Total: ${totalBookings} vs ${opt_totalBookings}`);
    console.log(`- Pending: ${pendingBookings} vs ${opt_pendingBookings}`);
    console.log(`- Booked: ${bookedBookings} vs ${opt_bookedBookings}`);
    console.log(`- Delivered: ${deliveredBookings} vs ${opt_deliveredBookings}`);
    console.log(`- Cancelled: ${cancelledBookings} vs ${opt_cancelledBookings}`);

    console.log(`\nJoin App counts:`);
    console.log(`- Total: ${totalApps} vs ${opt_totalApps}`);
    console.log(`- Pending: ${pendingApps} vs ${opt_pendingApps}`);
    console.log(`- Approved: ${approvedApps} vs ${opt_approvedApps}`);
    console.log(`- Rejected: ${rejectedApps} vs ${opt_rejectedApps}`);

    console.log(`\nRecent Bookings FullNames:`);
    for (let i = 0; i < recentBookings.length; i++) {
      console.log(`[${i}] Booking ID ${recentBookings[i].id}:`);
      console.log(`  - Original name: ${recentBookings[i].fullName}`);
      console.log(`  - Optimized name: ${opt_recentBookings[i].fullName}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
