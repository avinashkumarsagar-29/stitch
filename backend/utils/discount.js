const Discount = require("../models/Discount");

async function checkFirstOrderDiscount(userId) {
  if (!userId) {
    return { eligible: false };
  }

  let discount = await Discount.findOne({ userId });
  if (!discount) {
    try {
      discount = new Discount({ userId });
      await discount.save();
    } catch (err) {
      // Handle potential race condition if created concurrently
      discount = await Discount.findOne({ userId });
      if (!discount) {
        throw err;
      }
    }
  }

  if (!discount.firstOrderDiscountUsed) {
    return { eligible: true, percent: 20, minOrder: 300 };
  }

  return { eligible: false };
}

async function markFirstOrderDiscountUsed(userId) {
  if (!userId) return;

  await Discount.findOneAndUpdate(
    { userId },
    { firstOrderDiscountUsed: true, usedAt: new Date() },
    { upsert: true, returnDocument: 'after' }
  );
}

module.exports = {
  checkFirstOrderDiscount,
  markFirstOrderDiscountUsed,
};
