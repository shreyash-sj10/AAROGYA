const { toSafeNumber } = require("../utils/safeUtils");

const MINIMUM_SAFE_CALORIES = 300;

function toNonNegativeNumber(value) {
  return Math.max(0, toSafeNumber(value, 0));
}

function getNextMealTarget(state, totalDailyCalories, remainingMeals) {
  const safeState = state && typeof state === "object" ? state : {};
  const totals = safeState.totals && typeof safeState.totals === "object" ? safeState.totals : {};
  const consumed = toNonNegativeNumber(totals.calories);
  const dailyTarget = toNonNegativeNumber(totalDailyCalories);
  const safeRemainingMeals = Math.max(1, Math.floor(toSafeNumber(remainingMeals, 1)));
  const remaining = dailyTarget - consumed;

  if (remaining <= 0) {
    return MINIMUM_SAFE_CALORIES;
  }

  const target = remaining / safeRemainingMeals;

  if (target <= 0) {
    return MINIMUM_SAFE_CALORIES;
  }

  return Number(target.toFixed(6));
}

module.exports = {
  getNextMealTarget,
};
