const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const bookingSchema = new mongoose.Schema({
  _id: { type: Number },
  userId: { type: Number, ref: "User", default: null },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true },
  tailorApplicationId: { type: Number, ref: "JoinApplication", default: null },
  tailorName: { type: String, default: null },
  tailorEmail: { type: String, default: null },
  tailorPhoneNumber: { type: String, default: null },
  clothCategory: { type: String, default: null },
  clothImage: { type: String, default: null },
  material: { type: String, default: null },
  approxPrice: { type: Number, default: null },
  status: { type: String, default: "pending" },
  trackingCode: { type: String, default: null },
  referralDiscount: { type: Number, default: 0.00 },
  creditApplied: { type: Number, default: 0.00 },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

bookingSchema.virtual("id").get(function () {
  return this._id;
});

bookingSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

bookingSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for query optimization
bookingSchema.index({ userId: 1 });
bookingSchema.index({ tailorApplicationId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ trackingCode: 1 });

bookingSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("bookingId");
  }
});

module.exports = mongoose.model("Booking", bookingSchema);
