/**
 * @file Referral.js
 * @description Mongoose model mirroring dbo.Referrals SQL table.
 * 
 * Foreign Key Mappings:
 * - referrerUserId -> ref: 'User' (Number)
 * - referredUserId -> ref: 'User' (Number)
 */

const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const referralSchema = new mongoose.Schema({
  _id: { type: Number },
  referrerUserId: { type: Number, ref: "User", required: true },
  referredUserId: { type: Number, ref: "User", required: true },
  referralCode: { type: String, maxlength: 20, required: true },
  rewardGranted: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

referralSchema.virtual("id").get(function () {
  return this._id;
});

referralSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

referralSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for foreign keys
referralSchema.index({ referrerUserId: 1 });
referralSchema.index({ referredUserId: 1 });

referralSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("referralId");
  }
});

module.exports = mongoose.model("Referral", referralSchema);
