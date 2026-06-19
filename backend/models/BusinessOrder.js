/**
 * @file BusinessOrder.js
 * @description Mongoose model mirroring dbo.BusinessOrders SQL table.
 * 
 * Foreign Key Mappings:
 * - userId -> ref: 'User' (Number)
 * - tailorApplicationId -> ref: 'JoinApplication' (Number, optional)
 */

const mongoose = require("mongoose");
const { getNextSequenceValue } = require("./Counter");

const businessOrderSchema = new mongoose.Schema({
  _id: { type: Number },
  userId: { type: Number, ref: "User", required: true },
  companyName: { type: String, required: true },
  contactName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  businessType: { type: String, required: true },
  quantity: { type: Number, required: true },
  requirements: { type: String, default: null },
  approxPrice: { type: Number, default: null },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date, default: null },
  targetDeliveryDate: { type: Date, default: null },
  location: { type: String, default: null },
  tailorApplicationId: { type: Number, ref: "JoinApplication", default: null },
  tailorName: { type: String, default: null },
  tailorEmail: { type: String, default: null },
  tailorPhoneNumber: { type: String, default: null },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

businessOrderSchema.virtual("id").get(function () {
  return this._id;
});

businessOrderSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

businessOrderSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for foreign keys
businessOrderSchema.index({ userId: 1 });
businessOrderSchema.index({ tailorApplicationId: 1 });

businessOrderSchema.pre("save", async function () {
  if (this.isNew && typeof this._id !== "number") {
    this._id = await getNextSequenceValue("businessOrderId");
  }
});

module.exports = mongoose.model("BusinessOrder", businessOrderSchema);
