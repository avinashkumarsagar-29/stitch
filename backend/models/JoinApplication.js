const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const joinApplicationSchema = new mongoose.Schema({
  _id: { type: Number },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, default: "" },
  phoneNumber: { type: String, default: "" },
  experience: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: String, default: null },
  plan: { type: String, default: "Free" },
  status: { type: String, default: "pending" },
  rejectionReason: { type: String, default: null },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

joinApplicationSchema.virtual("id").get(function () {
  return this._id;
});

joinApplicationSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

joinApplicationSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for query optimization
joinApplicationSchema.index({ email: 1 });
joinApplicationSchema.index({ phoneNumber: 1 });
joinApplicationSchema.index({ status: 1 });
joinApplicationSchema.index({ createdAt: -1 });

joinApplicationSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("joinApplicationId");
  }
});

module.exports = mongoose.model("JoinApplication", joinApplicationSchema);
