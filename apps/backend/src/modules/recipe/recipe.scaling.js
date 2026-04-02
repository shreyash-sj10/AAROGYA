function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function scaleMacro(value, scaleFactor) {
  return round(Math.max(0, toSafeNumber(value, 0) * scaleFactor));
}

function scaleRecipeAggregate(recipe, requested_grams) {
  const base = clonePlain(recipe && typeof recipe === "object" ? recipe : {});
  const defaultServing = toSafeNumber(base.default_serving_size_grams, 0);
  const requestedGrams = toSafeNumber(requested_grams, 0);
  const scaleFactor = defaultServing > 0 ? requestedGrams / defaultServing : 1;

  if (base.aggregates && base.aggregates.nutrition && typeof base.aggregates.nutrition === "object") {
    base.aggregates.nutrition.calories = scaleMacro(base.aggregates.nutrition.calories, scaleFactor);
    base.aggregates.nutrition.protein = scaleMacro(base.aggregates.nutrition.protein, scaleFactor);
    base.aggregates.nutrition.carbs = scaleMacro(base.aggregates.nutrition.carbs, scaleFactor);
    base.aggregates.nutrition.fat = scaleMacro(base.aggregates.nutrition.fat, scaleFactor);
  }

  if (typeof base.calories === "number") {
    base.calories = scaleMacro(base.calories, scaleFactor);
  }

  if (typeof base.protein === "number") {
    base.protein = scaleMacro(base.protein, scaleFactor);
  }

  if (typeof base.carbs === "number") {
    base.carbs = scaleMacro(base.carbs, scaleFactor);
  }

  if (typeof base.fat === "number") {
    base.fat = scaleMacro(base.fat, scaleFactor);
  }

  return base;
}

module.exports = {
  scaleRecipeAggregate,
};
