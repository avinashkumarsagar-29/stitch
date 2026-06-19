const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const userSchema = new mongoose.Schema({
  _id: { type: Number },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, default: "" },
  role: { type: String, default: "user" },
  plan: { type: String, default: "Free" },
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
  address: { type: String, default: null },
  image: { type: String, default: null },
  isBanned: { type: Boolean, default: false },
  referralCode: { type: String, default: null },
  credit: { type: Number, default: 0.00 },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.virtual("id").get(function () {
  return this._id;
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

userSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

userSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("userId");
  }
});

module.exports = mongoose.model("User", userSchema);
