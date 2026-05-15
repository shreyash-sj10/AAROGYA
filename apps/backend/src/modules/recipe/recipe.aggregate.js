const { toSafeObject, toSafeNumber, toSafeArray } = require("../../utils/safeUtils");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function normalizeDosha(raw) {
  const scaled = {
    vata: clamp((toSafeNumber(raw.vata, 0) + 1) / 2, 0, 1),
    pitta: clamp((toSafeNumber(raw.pitta, 0) + 1) / 2, 0, 1),
    kapha: clamp((toSafeNumber(raw.kapha, 0) + 1) / 2, 0, 1),
  };

  const total = scaled.vata + scaled.pitta + scaled.kapha;

  if (total <= 0) {
    return { vata: 0.333333, pitta: 0.333333, kapha: 0.333334 };
  }

  return {
    vata: round(scaled.vata / total),
    pitta: round(scaled.pitta / total),
    kapha: round(scaled.kapha / total),
  };
}

function computeRecipeAggregate(recipeIngredients, foodsMap) {
  const safeFoodsMap = toSafeObject(foodsMap);
  const normalizedIngredients = toSafeArray(recipeIngredients)
    .map((ingredient) => {
      const safeIngredient = toSafeObject(ingredient);
      const foodId = typeof safeIngredient.food_id === "string" ? safeIngredient.food_id : "";
      const quantityGrams = clamp(toSafeNumber(safeIngredient.quantity_grams, 0), 0, Number.MAX_SAFE_INTEGER);

      return {
        food_id: foodId,
        quantity_grams: quantityGrams,
      };
    })
    .filter((ingredient) => ingredient.food_id);

  const totals = normalizedIngredients.reduce((acc, ingredient) => {
    const food = toSafeObject(safeFoodsMap[ingredient.food_id]);
    const nutrition = toSafeObject(food.nutrition);
    const dosha = toSafeObject(food.dosha_effect);
    const functional = toSafeObject(food.functional);
    const grams = ingredient.quantity_grams;
    const factor = grams / 100;

    const calories = Math.max(0, toSafeNumber(nutrition.calories, 0) * factor);
    const protein = Math.max(0, toSafeNumber(nutrition.protein, 0) * factor);
    const carbs = Math.max(0, toSafeNumber(nutrition.carbs, 0) * factor);
    const fat = Math.max(0, toSafeNumber(nutrition.fat, 0) * factor);

    acc.calories += calories;
    acc.protein += protein;
    acc.carbs += carbs;
    acc.fat += fat;

    acc.giWeightedCarbs += carbs * Math.max(0, toSafeNumber(nutrition.glycemic_index, 0));

    acc.totalGrams += grams;
    acc.vata += toSafeNumber(dosha.vata, 0) * grams;
    acc.pitta += toSafeNumber(dosha.pitta, 0) * grams;
    acc.kapha += toSafeNumber(dosha.kapha, 0) * grams;

    acc.digestibility += clamp(toSafeNumber(functional.digestibility_score, 0), 0, 1) * grams;
    acc.heaviness += clamp(toSafeNumber(functional.heaviness_score, 0), 0, 1) * grams;

    return acc;
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    giWeightedCarbs: 0,
    totalGrams: 0,
    vata: 0,
    pitta: 0,
    kapha: 0,
    digestibility: 0,
    heaviness: 0,
  });

  const gi = totals.carbs <= 0 ? 0 : totals.giWeightedCarbs / totals.carbs;

  const rawDosha = totals.totalGrams > 0
    ? {
      vata: totals.vata / totals.totalGrams,
      pitta: totals.pitta / totals.totalGrams,
      kapha: totals.kapha / totals.totalGrams,
    }
    : { vata: 0, pitta: 0, kapha: 0 };

  const doshaEstimate = normalizeDosha(rawDosha);
  const digestibilityScore = totals.totalGrams > 0 ? totals.digestibility / totals.totalGrams : 0;
  const heavinessScore = totals.totalGrams > 0 ? totals.heaviness / totals.totalGrams : 0;

  return {
    version: "RecipeAggregate_v1",
    schema_version: 1,
    compatibility: "backward",
    recipe_id: "computed_recipe",
    name: "Computed Recipe",
    category: "composite",
    ingredients: normalizedIngredients.map((ingredient) => ({
      food_id: ingredient.food_id,
      quantity: {
        value: round(ingredient.quantity_grams),
        unit: "grams",
      },
    })),
    aggregation_basis: "per_serving",
    aggregates: {
      nutrition: {
        calories: round(totals.calories),
        protein: round(totals.protein),
        carbs: round(totals.carbs),
        fat: round(totals.fat),
        glycemic_index: round(clamp(gi, 0, 100)),
      },
      dosha_estimate: doshaEstimate,
      functional: {
        digestibility_score: round(clamp(digestibilityScore, 0, 1)),
        heaviness_score: round(clamp(heavinessScore, 0, 1)),
      },
    },
  };
}

module.exports = {
  computeRecipeAggregate,
};
