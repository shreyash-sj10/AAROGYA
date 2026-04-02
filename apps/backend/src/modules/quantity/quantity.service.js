const { calculateTDEE, applyGoalAdjustment } = require("./energy.engine");
const { getMealCalories } = require("./distribution.engine");
const { scaleMealRecipes } = require("./scaling.engine");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeGoal(goalValue) {
  if (typeof goalValue !== "string") {
    return "GOAL_MAINTENANCE";
  }

  const normalized = goalValue.trim().toLowerCase();

  if (normalized === "goal_weight_loss" || normalized === "weight_loss") {
    return "GOAL_WEIGHT_LOSS";
  }

  if (normalized === "goal_muscle_gain" || normalized === "muscle_gain") {
    return "GOAL_MUSCLE_GAIN";
  }

  if (normalized === "goal_maintenance" || normalized === "maintenance") {
    return "GOAL_MAINTENANCE";
  }

  return "GOAL_MAINTENANCE";
}

function generateQuantities({ recipes, user, context } = {}) {
  const safeRecipes = toSafeArray(recipes);
  const safeUser = toSafeObject(user);
  const safeContext = toSafeObject(context);

  const overrideTargetCalories = toSafeNumber(safeContext.targetCalories, NaN);
  const tdee = calculateTDEE(safeUser);
  const goal = normalizeGoal(safeUser.goal || safeContext.goal);
  const adjustedCalories = applyGoalAdjustment(tdee, goal);
  const mealCalories = Number.isFinite(overrideTargetCalories)
    ? Math.max(0, overrideTargetCalories)
    : getMealCalories(adjustedCalories, safeContext);

  return scaleMealRecipes(safeRecipes, mealCalories);
}

module.exports = {
  generateQuantities,
};
