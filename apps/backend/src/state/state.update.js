const QUANTITY_CONFIG = require("../../config/quantity");
const { createEmptyState } = require("./state.model");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNonNegative(value) {
  return Math.max(0, toSafeNumber(value, 0));
}

function normalizeDosha(values) {
  const safeValues = toSafeObject(values);
  const vata = toNonNegative(safeValues.vata);
  const pitta = toNonNegative(safeValues.pitta);
  const kapha = toNonNegative(safeValues.kapha);
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return {
      vata: 0.333333,
      pitta: 0.333333,
      kapha: 0.333334,
    };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));
  const nk = Number((1 - nv - np).toFixed(6));

  return {
    vata: nv,
    pitta: np,
    kapha: nk,
  };
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function isCorruptState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return true;
  }

  const totals = state.totals;
  const dosha = state.dosha_balance;
  const meals = state.meals;

  if (!totals || typeof totals !== "object" || Array.isArray(totals)) {
    return true;
  }

  if (!dosha || typeof dosha !== "object" || Array.isArray(dosha)) {
    return true;
  }

  if (!Array.isArray(meals)) {
    return true;
  }

  const totalKeys = ["calories", "protein", "carbs", "fat"];
  if (totalKeys.some((key) => !Number.isFinite(totals[key]) || totals[key] < 0)) {
    return true;
  }

  const doshaKeys = ["vata", "pitta", "kapha"];
  if (doshaKeys.some((key) => !Number.isFinite(dosha[key]) || dosha[key] < 0)) {
    return true;
  }

  return false;
}

function getDailyTargetCalories(state) {
  const safeState = toSafeObject(state);

  if (Number.isFinite(safeState.daily_target_calories) && safeState.daily_target_calories > 0) {
    return safeState.daily_target_calories;
  }

  if (Number.isFinite(safeState.totalDailyCalories) && safeState.totalDailyCalories > 0) {
    return safeState.totalDailyCalories;
  }

  if (Number.isFinite(safeState.target_calories) && safeState.target_calories > 0) {
    return safeState.target_calories;
  }

  return QUANTITY_CONFIG.defaultCalories;
}

function updateStateWithMeal(state, meal) {
  const inputState = isCorruptState(state)
    ? createEmptyState(
      toSafeString(toSafeObject(state).user_id, ""),
      toSafeString(toSafeObject(state).date, "")
    )
    : clonePlain(toSafeObject(state));

  const safeState = toSafeObject(inputState);
  const safeMeal = toSafeObject(meal);
  const safeTotals = toSafeObject(safeState.totals);
  const safeMealNutrition = toSafeObject(safeMeal.nutrition);
  const safeDosha = normalizeDosha(toSafeObject(safeState.dosha_balance));
  const safeMealDosha = toSafeObject(safeMeal.dosha_effect);
  const existingMeals = toSafeArray(safeState.meals).map((entry) => clonePlain(toSafeObject(entry)));

  const dailyTargetCalories = toNonNegative(getDailyTargetCalories(safeState));
  const maxCalories = Number((dailyTargetCalories * 2).toFixed(6));

  const totalsBeforeCap = {
    calories: toNonNegative(safeTotals.calories) + toNonNegative(safeMealNutrition.calories),
    protein: toNonNegative(safeTotals.protein) + toNonNegative(safeMealNutrition.protein),
    carbs: toNonNegative(safeTotals.carbs) + toNonNegative(safeMealNutrition.carbs),
    fat: toNonNegative(safeTotals.fat) + toNonNegative(safeMealNutrition.fat),
  };

  const updatedTotals = {
    calories: Math.min(maxCalories, totalsBeforeCap.calories),
    protein: totalsBeforeCap.protein,
    carbs: totalsBeforeCap.carbs,
    fat: totalsBeforeCap.fat,
  };

  const doshaAccumulated = {
    vata: toNonNegative(safeDosha.vata) + toNonNegative(safeMealDosha.vata),
    pitta: toNonNegative(safeDosha.pitta) + toNonNegative(safeMealDosha.pitta),
    kapha: toNonNegative(safeDosha.kapha) + toNonNegative(safeMealDosha.kapha),
  };

  const normalizedDosha = normalizeDosha(doshaAccumulated);

  const mealEntry = {
    meal_type: toSafeString(safeMeal.meal_type, ""),
    recipes: toSafeArray(safeMeal.recipes).map((entry) => clonePlain(toSafeObject(entry))),
    calories: toNonNegative(safeMealNutrition.calories),
  };

  return {
    ...safeState,
    totals: {
      calories: Number(updatedTotals.calories.toFixed(6)),
      protein: Number(updatedTotals.protein.toFixed(6)),
      carbs: Number(updatedTotals.carbs.toFixed(6)),
      fat: Number(updatedTotals.fat.toFixed(6)),
    },
    dosha_balance: {
      vata: Number(toNonNegative(normalizedDosha.vata).toFixed(6)),
      pitta: Number(toNonNegative(normalizedDosha.pitta).toFixed(6)),
      kapha: Number(toNonNegative(normalizedDosha.kapha).toFixed(6)),
    },
    meals: [...existingMeals, mealEntry],
  };
}

module.exports = {
  updateStateWithMeal,
};
