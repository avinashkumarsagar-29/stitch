/**
 * @file Payment.js
 * @description Mongoose model mirroring dbo.Payments SQL table.
 * 
 * Foreign Key Mappings:
 * - userId -> ref: 'User' (Number)
 */

const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const paymentSchema = new mongoose.Schema({
  _id: { type: Number },
  userId: { type: Number, ref: "User", required: true },
  amount: { type: Number, required: true },
  planPurchased: { type: String, required: true },
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  status: { type: String, default: "pending" },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

paymentSchema.virtual("id").get(function () {
  return this._id;
});

paymentSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

paymentSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for foreign keys
paymentSchema.index({ userId: 1 });

paymentSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("paymentId");
  }
});

module.exports = mongoose.model("Payment", paymentSchema);
