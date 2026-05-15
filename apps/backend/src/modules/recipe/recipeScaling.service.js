const { toSafeArray, toSafeNumber, toSafeObject, toSafeString } = require("../../utils/safeUtils");
const { validateScaledRecipe } = require("../../contracts/validators/validateScaledRecipe");

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function readNutrition(item) {
  const nutrition = toSafeObject(toSafeObject(item).nutrition);
  return {
    calories: Math.max(0, toSafeNumber(nutrition.calories, 0)),
    protein: Math.max(0, toSafeNumber(nutrition.protein, 0)),
    carbs: Math.max(0, toSafeNumber(nutrition.carbs, 0)),
    fat: Math.max(0, toSafeNumber(nutrition.fat, 0)),
  };
}

function getCurrentCalories(items) {
  return toSafeArray(items).reduce((sum, item) => sum + readNutrition(item).calories, 0);
}

function resolveTargetCalories(currentCalories, userState, constraints) {
  const safeUserState = toSafeObject(userState);
  const safeContext = toSafeObject(safeUserState.context);
  const safeConstraints = toSafeObject(constraints);

  const candidates = [
    toSafeNumber(safeContext.target_calories, NaN),
    toSafeNumber(safeUserState.target_calories, NaN),
    toSafeNumber(safeConstraints.target_calories, NaN),
    toSafeNumber(safeConstraints.max_calories, NaN),
  ];

  const firstValid = candidates.find((value) => Number.isFinite(value) && value > 0);
  const provisional = Number.isFinite(firstValid) ? firstValid : currentCalories;

  const maxCalories = toSafeNumber(safeConstraints.max_calories, NaN);
  if (Number.isFinite(maxCalories) && maxCalories > 0) {
    return Math.min(provisional, maxCalories);
  }

  return provisional;
}

function buildScaledRecipe(item, mealType) {
  const safeItem = toSafeObject(item);
  const safeQuantity = toSafeObject(safeItem.quantity);
  const nutrition = readNutrition(safeItem);
  const quantityValue = Math.max(0, toSafeNumber(safeQuantity.value, 100));

  const scaledRecipe = {
    food: toSafeString(safeItem.name || safeItem.recipe_id || safeItem.id, "meal"),
    quantity: `${round(quantityValue)}g`,
    calories: round(nutrition.calories),
    protein: round(nutrition.protein),
    carbs: round(nutrition.carbs),
    fat: round(nutrition.fat),
    meal_type: toSafeString(mealType, "meal"),
  };

  const validation = validateScaledRecipe(scaledRecipe);
  if (!validation.valid) {
    throw new Error(`ScaledRecipe_v1 validation failed: ${JSON.stringify(validation.errors || [])}`);
  }

  return scaledRecipe;
}

function scaleItem(item, scaleFactor, mealType) {
  const safeItem = toSafeObject(item);
  const safeQuantity = toSafeObject(safeItem.quantity);
  const baseQuantity = Math.max(0, toSafeNumber(safeQuantity.value, 100));
  const nutrition = readNutrition(safeItem);

  const scaledItem = {
    ...safeItem,
    quantity: {
      value: round(baseQuantity * scaleFactor),
      unit: toSafeString(safeQuantity.unit, "grams"),
    },
    nutrition: {
      calories: round(nutrition.calories * scaleFactor),
      protein: round(nutrition.protein * scaleFactor),
      carbs: round(nutrition.carbs * scaleFactor),
      fat: round(nutrition.fat * scaleFactor),
    },
  };

  scaledItem.scaled_recipe = buildScaledRecipe(scaledItem, mealType);
  return scaledItem;
}

function applyRecipeScaling(input) {
  const safeInput = toSafeObject(input);
  const safeMealResult = clonePlain(toSafeObject(safeInput.mealResult));
  const safeBreakdown = toSafeObject(safeMealResult.breakdown);
  const items = toSafeArray(safeBreakdown.items);

  if (items.length === 0) {
    return safeMealResult;
  }

  const currentCalories = getCurrentCalories(items);
  const targetCalories = resolveTargetCalories(currentCalories, safeInput.userState, safeInput.constraints);

  let scaleFactor = currentCalories > 0 ? (targetCalories / currentCalories) : 1;
  scaleFactor = clamp(scaleFactor, 0.3, 3);

  const scaledItems = items.map((item) => scaleItem(item, scaleFactor, safeInput.mealType));

  safeMealResult.breakdown = {
    ...safeBreakdown,
    items: scaledItems,
    meta: {
      ...toSafeObject(safeBreakdown.meta),
      scaled: true,
      scaling_factor: round(scaleFactor),
      target_calories: round(targetCalories),
    },
  };

  return safeMealResult;
}

module.exports = {
  applyRecipeScaling,
};
