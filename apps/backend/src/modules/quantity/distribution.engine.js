const QUANTITY_CONFIG = require("../../config/quantity");
const { toSafeNumber } = require("../../utils/safeUtils");

function normalizeMealType(context) {
  if (!context || typeof context !== "object") {
    return "";
  }

  const mealType = typeof context.meal_type === "string"
    ? context.meal_type
    : (typeof context.mealType === "string" ? context.mealType : "");

  return mealType.trim().toLowerCase();
}

function getMealCalories(totalCalories, context) {
  const safeTotalCalories = Math.max(0, toSafeNumber(totalCalories, 0));
  const mealType = normalizeMealType(context);
  const ratio = QUANTITY_CONFIG.mealDistribution[mealType] || (1 / 3);

  return safeTotalCalories * ratio;
}

module.exports = {
  getMealCalories,
};
