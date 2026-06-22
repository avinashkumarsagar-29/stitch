/**
 * @file Review.js
 * @description Mongoose model mirroring dbo.Reviews SQL table.
 * 
 * Foreign Key Mappings:
 * - bookingId -> ref: 'Booking' (Number)
 * - userId -> ref: 'User' (Number)
 * - tailorApplicationId -> ref: 'JoinApplication' (Number)
 */

const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const reviewSchema = new mongoose.Schema({
  _id: { type: Number },
  bookingId: { type: Number, ref: "Booking", required: true },
  userId: { type: Number, ref: "User", required: true },
  tailorApplicationId: { type: Number, ref: "JoinApplication", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500, default: null },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

reviewSchema.virtual("id").get(function () {
  return this._id;
});

reviewSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

reviewSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for foreign keys
reviewSchema.index({ bookingId: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ tailorApplicationId: 1 });
reviewSchema.index({ createdAt: -1 });

reviewSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("reviewId");
  }
});

module.exports = mongoose.model("Review", reviewSchema);
