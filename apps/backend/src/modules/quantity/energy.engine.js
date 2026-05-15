const QUANTITY_CONFIG = require("../../config/quantity");
const { toSafeNumber } = require("../../utils/safeUtils");

const GOAL_WEIGHT_LOSS = "GOAL_WEIGHT_LOSS";
const GOAL_MAINTENANCE = "GOAL_MAINTENANCE";
const GOAL_MUSCLE_GAIN = "GOAL_MUSCLE_GAIN";



function normalizeActivityLevel(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeGoal(goal) {
  if (typeof goal !== "string") {
    return "";
  }

  return goal.trim().toUpperCase();
}

function calculateTDEE(user) {
  const safeUser = user && typeof user === "object" ? user : {};
  const weight = toSafeNumber(safeUser.weight, NaN);

  if (!Number.isFinite(weight) || weight <= 0) {
    return QUANTITY_CONFIG.defaultCalories;
  }

  const activityLevel = normalizeActivityLevel(safeUser.activity_level);
  const multiplier = QUANTITY_CONFIG.activityMultipliers[activityLevel] || QUANTITY_CONFIG.activityMultipliers.moderate;

  return weight * multiplier;
}

function applyGoalAdjustment(tdee, goal) {
  const baseTdee = toSafeNumber(tdee, 0);
  const normalizedGoal = normalizeGoal(goal);

  if (normalizedGoal === GOAL_WEIGHT_LOSS) {
    return baseTdee + QUANTITY_CONFIG.goalAdjustments.GOAL_WEIGHT_LOSS;
  }

  if (normalizedGoal === GOAL_MUSCLE_GAIN) {
    return baseTdee + QUANTITY_CONFIG.goalAdjustments.GOAL_MUSCLE_GAIN;
  }

  if (normalizedGoal === GOAL_MAINTENANCE) {
    return baseTdee + QUANTITY_CONFIG.goalAdjustments.GOAL_MAINTENANCE;
  }

  return baseTdee;
}

module.exports = {
  calculateTDEE,
  applyGoalAdjustment,
};
