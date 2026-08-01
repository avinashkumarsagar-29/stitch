const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const measurementSchema = new mongoose.Schema({
  _id: { type: Number },
  userId: { type: Number, ref: "User", required: true },
  chest: { type: Number, default: null },
  waist: { type: Number, default: null },
  hip: { type: Number, default: null },
  shoulder: { type: Number, default: null },
  inseam: { type: Number, default: null },
  height: { type: Number, default: null },
  sleeve: { type: Number, default: null },
  calibrationFactors: {
    chest: { type: Number, default: 1.0 },
    waist: { type: Number, default: 1.0 },
    hip: { type: Number, default: 1.0 },
    shoulder: { type: Number, default: 1.0 },
    inseam: { type: Number, default: 1.0 },
    sleeve: { type: Number, default: 1.0 },
  }
}, {
  timestamps: { createdAt: false, updatedAt: "updatedAt" },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

measurementSchema.virtual("id").get(function () {
  return this._id;
});

measurementSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

measurementSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for query optimization
measurementSchema.index({ userId: 1 });

measurementSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("measurementId");
  }
});

module.exports = mongoose.model("Measurement", measurementSchema);
