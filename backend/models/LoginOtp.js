const mongoose = require("mongoose");

const loginOtpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otpCode: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

loginOtpSchema.virtual("id").get(function () {
  return this._id;
});

loginOtpSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

loginOtpSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for query optimization
loginOtpSchema.index({ email: 1 });
loginOtpSchema.index({ createdAt: -1 });
loginOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("LoginOtp", loginOtpSchema);
