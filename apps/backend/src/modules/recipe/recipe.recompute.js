function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeString(value) {
  return typeof value === "string" ? value : "";
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function canonicalNutrition(nutrition) {
  const safeNutrition = toSafeObject(nutrition);
  const keys = Object.keys(safeNutrition).sort();

  return keys.reduce((acc, key) => {
    const value = safeNutrition[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      acc[key] = Number(value.toFixed(6));
    } else if (typeof value === "string") {
      acc[key] = value;
    } else {
      acc[key] = null;
    }

    return acc;
  }, {});
}

function buildFoodsMap(foodsData) {
  if (foodsData && typeof foodsData === "object" && !Array.isArray(foodsData)) {
    return foodsData;
  }

  return toSafeArray(foodsData).reduce((acc, food) => {
    const safeFood = toSafeObject(food);
    const id = toSafeString(safeFood.id);

    if (id) {
      acc[id] = safeFood;
    }

    return acc;
  }, {});
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function generateSourceHash(recipeIngredients, foodsData) {
  const foodsMap = buildFoodsMap(foodsData);

  const canonicalIngredients = toSafeArray(recipeIngredients)
    .map((ingredient) => {
      const safeIngredient = toSafeObject(ingredient);
      const foodId = toSafeString(safeIngredient.food_id);
      const quantityGrams = Number(toSafeNumber(safeIngredient.quantity_grams, 0).toFixed(6));
      const food = toSafeObject(foodsMap[foodId]);

      return {
        food_id: foodId,
        quantity_grams: quantityGrams,
        nutrition: canonicalNutrition(food.nutrition),
      };
    })
    .filter((item) => item.food_id)
    .sort((left, right) => {
      if (left.food_id !== right.food_id) {
        return left.food_id.localeCompare(right.food_id);
      }

      return left.quantity_grams - right.quantity_grams;
    });

  return fnv1aHash(JSON.stringify(canonicalIngredients));
}

function shouldRecomputeAggregate(existingAggregate, newSourceHash) {
  const safeAggregate = toSafeObject(existingAggregate);
  const currentHash = toSafeString(safeAggregate.source_hash);
  const nextHash = toSafeString(newSourceHash);

  return currentHash !== nextHash;
}

module.exports = {
  shouldRecomputeAggregate,
  generateSourceHash,
};
