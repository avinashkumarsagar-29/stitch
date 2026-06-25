const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({
  userId: { type: Number, ref: "User", required: true },
  firstOrderDiscountUsed: { type: Boolean, default: false },
  usedAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

discountSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("Discount", discountSchema);
