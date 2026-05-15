const QUANTITY_CONFIG = require("../../config/quantity");
const { toSafeObject, toSafeNumber, toSafeArray } = require("../../utils/safeUtils");

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function getRecipeCalories(recipe) {
  const safeRecipe = toSafeObject(recipe);
  const safeAggregates = toSafeObject(safeRecipe.aggregates);
  const safeNutrition = toSafeObject(safeAggregates.nutrition);

  if (Number.isFinite(safeNutrition.calories)) {
    return Math.max(0, safeNutrition.calories);
  }

  if (Number.isFinite(safeRecipe.calories)) {
    return Math.max(0, safeRecipe.calories);
  }

  return 0;
}

function getDefaultServingSize(recipe) {
  const safeRecipe = toSafeObject(recipe);
  return Math.max(0, toSafeNumber(safeRecipe.default_serving_size_grams, 0));
}

function normalizeScaleFactor(value) {
  const safeValue = toSafeNumber(value, 1);

  if (safeValue > 3) {
    return QUANTITY_CONFIG.scalingLimits.max;
  }

  if (safeValue < 0.3) {
    return QUANTITY_CONFIG.scalingLimits.min;
  }

  return Math.min(QUANTITY_CONFIG.scalingLimits.max, Math.max(QUANTITY_CONFIG.scalingLimits.min, safeValue));
}

function buildScaledRecipeQuantity(recipe, scaleFactor) {
  const safeRecipe = toSafeObject(recipe);
  const recipeId = typeof safeRecipe.recipe_id === "string"
    ? safeRecipe.recipe_id
    : (typeof safeRecipe.id === "string" ? safeRecipe.id : "");
  const defaultServingSize = getDefaultServingSize(safeRecipe);
  const safeScaleFactor = normalizeScaleFactor(scaleFactor);

  return {
    recipe_id: recipeId,
    quantity: {
      value: round(defaultServingSize * safeScaleFactor),
      unit: "grams",
    },
  };
}

function scaleMealRecipes(recipes, targetCalories) {
  const safeRecipes = toSafeArray(recipes);
  const safeTargetCalories = Math.max(0, toSafeNumber(targetCalories, QUANTITY_CONFIG.defaultCalories));

  const totalRecipeCalories = safeRecipes.reduce((sum, recipe) => sum + getRecipeCalories(recipe), 0);

  if (totalRecipeCalories === 0) {
    return safeRecipes.map((recipe) => buildScaledRecipeQuantity(recipe, 1));
  }

  const rawScaleFactor = safeTargetCalories / totalRecipeCalories;
  const scaleFactor = normalizeScaleFactor(rawScaleFactor);

  return safeRecipes.map((recipe) => buildScaledRecipeQuantity(recipe, scaleFactor));
}

module.exports = {
  scaleMealRecipes,
};
