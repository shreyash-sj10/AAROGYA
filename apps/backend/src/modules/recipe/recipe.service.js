const Ajv = require("ajv");
const {
  getRecipesByCategory,
  getRecipeIngredients,
  getRecipeAggregate,
} = require("./recipe.repository");
const { computeRecipeAggregate } = require("./recipe.aggregate");
const { recipeAggregateSchema } = require("../../contracts/schemaLoader");

const ajv = new Ajv({ strict: true, allErrors: true });
const validateRecipeAggregate = ajv.compile(recipeAggregateSchema);

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function buildFoodsMap(context) {
  const safeContext = toSafeObject(context);

  if (safeContext.foodsMap && typeof safeContext.foodsMap === "object") {
    return safeContext.foodsMap;
  }

  const foods = toSafeArray(safeContext.foods);

  return foods.reduce((acc, food) => {
    const safeFood = toSafeObject(food);
    const id = toSafeString(safeFood.id, "");

    if (id) {
      acc[id] = safeFood;
    }

    return acc;
  }, {});
}

function getAllergySet(context) {
  const safeContext = toSafeObject(context);
  const safeUserState = toSafeObject(safeContext.userState);
  const allergies = safeContext.allergies || safeUserState.allergies;

  return new Set(
    toSafeArray(allergies)
      .map((item) => toSafeString(item, "").toLowerCase())
      .filter(Boolean)
  );
}

function requiresVegetarian(context) {
  const safeContext = toSafeObject(context);
  const safeUserState = toSafeObject(safeContext.userState);
  const dietValue = toSafeString(
    safeContext.diet_type || safeContext.dietType || safeUserState.diet_type || safeUserState.diet,
    ""
  ).toLowerCase();

  if (toSafeBoolean(safeContext.onlyVegetarian, false)) {
    return true;
  }

  return dietValue === "vegetarian" || dietValue === "vegan" || dietValue === "veg";
}

function hasAllergyConflict(recipeIngredients, foodsMap, allergySet) {
  if (allergySet.size === 0) {
    return false;
  }

  return toSafeArray(recipeIngredients).some((ingredient) => {
    const safeIngredient = toSafeObject(ingredient);
    const foodId = toSafeString(safeIngredient.food_id, "").toLowerCase();

    if (foodId && allergySet.has(foodId)) {
      return true;
    }

    const food = toSafeObject(foodsMap[safeIngredient.food_id]);
    const tags = toSafeArray(food.tags)
      .map((tag) => toSafeString(tag, "").toLowerCase())
      .filter(Boolean);

    return tags.some((tag) => allergySet.has(tag));
  });
}

function normalizeIngredients(recipeIngredients) {
  return toSafeArray(recipeIngredients).map((ingredient) => {
    const safeIngredient = toSafeObject(ingredient);

    return {
      food_id: toSafeString(safeIngredient.food_id, ""),
      quantity_grams: Number.isFinite(safeIngredient.quantity_grams) ? safeIngredient.quantity_grams : 0,
    };
  }).filter((ingredient) => ingredient.food_id);
}

function normalizeAggregate(candidate, recipe, ingredients, computed) {
  const safeCandidate = toSafeObject(candidate);
  const safeRecipe = toSafeObject(recipe);
  const safeComputed = toSafeObject(computed);

  if (safeCandidate.aggregates && typeof safeCandidate.aggregates === "object") {
    return {
      version: toSafeString(safeCandidate.version, "RecipeAggregate_v1"),
      schema_version: Number.isFinite(safeCandidate.schema_version) ? safeCandidate.schema_version : 1,
      compatibility: toSafeString(safeCandidate.compatibility, "backward"),
      recipe_id: toSafeString(safeCandidate.recipe_id, toSafeString(safeRecipe.id, "")),
      name: toSafeString(safeCandidate.name, toSafeString(safeRecipe.name, "Computed Recipe")),
      category: toSafeString(safeCandidate.category, toSafeString(safeRecipe.category, "composite")),
      ingredients: toSafeArray(safeCandidate.ingredients).length > 0 ? safeCandidate.ingredients : safeComputed.ingredients,
      aggregation_basis: toSafeString(safeCandidate.aggregation_basis, "per_serving"),
      aggregates: safeCandidate.aggregates,
    };
  }

  const nutrition = {
    calories: Number.isFinite(safeCandidate.calories) ? safeCandidate.calories : safeComputed.aggregates.nutrition.calories,
    protein: Number.isFinite(safeCandidate.protein) ? safeCandidate.protein : safeComputed.aggregates.nutrition.protein,
    carbs: Number.isFinite(safeCandidate.carbs) ? safeCandidate.carbs : safeComputed.aggregates.nutrition.carbs,
    fat: Number.isFinite(safeCandidate.fat) ? safeCandidate.fat : safeComputed.aggregates.nutrition.fat,
    glycemic_index: Number.isFinite(safeCandidate.glycemic_index) ? safeCandidate.glycemic_index : safeComputed.aggregates.nutrition.glycemic_index,
  };

  const doshaEstimate = {
    vata: Number.isFinite(safeCandidate.vata_effect) ? safeCandidate.vata_effect : safeComputed.aggregates.dosha_estimate.vata,
    pitta: Number.isFinite(safeCandidate.pitta_effect) ? safeCandidate.pitta_effect : safeComputed.aggregates.dosha_estimate.pitta,
    kapha: Number.isFinite(safeCandidate.kapha_effect) ? safeCandidate.kapha_effect : safeComputed.aggregates.dosha_estimate.kapha,
  };

  const functional = {
    digestibility_score: Number.isFinite(safeCandidate.digestibility_score)
      ? safeCandidate.digestibility_score
      : safeComputed.aggregates.functional.digestibility_score,
    heaviness_score: Number.isFinite(safeCandidate.heaviness_score)
      ? safeCandidate.heaviness_score
      : safeComputed.aggregates.functional.heaviness_score,
  };

  return {
    version: toSafeString(safeCandidate.version, "RecipeAggregate_v1"),
    schema_version: Number.isFinite(safeCandidate.schema_version) ? safeCandidate.schema_version : 1,
    compatibility: toSafeString(safeCandidate.compatibility, "backward"),
    recipe_id: toSafeString(safeCandidate.recipe_id, toSafeString(safeRecipe.id, "")),
    name: toSafeString(safeRecipe.name, "Computed Recipe"),
    category: toSafeString(safeRecipe.category, "composite"),
    ingredients: safeComputed.ingredients,
    aggregation_basis: toSafeString(safeCandidate.aggregation_basis, "per_serving"),
    aggregates: {
      nutrition,
      dosha_estimate: doshaEstimate,
      functional,
    },
  };
}

async function getValidRecipes(context) {
  const safeContext = toSafeObject(context);
  const category = toSafeString(safeContext.category, "");

  if (!category) {
    return [];
  }

  const foodsMap = buildFoodsMap(safeContext);
  const allergySet = getAllergySet(safeContext);
  const vegetarianOnly = requiresVegetarian(safeContext);

  const recipes = await getRecipesByCategory(category);
  const safeRecipes = toSafeArray(recipes);
  const output = [];

  for (const recipe of safeRecipes) {
    const safeRecipe = toSafeObject(recipe);

    if (!toSafeString(safeRecipe.id, "")) {
      continue;
    }

    if (vegetarianOnly && !toSafeBoolean(safeRecipe.is_vegetarian, false)) {
      continue;
    }

    const recipeIngredients = normalizeIngredients(await getRecipeIngredients(safeRecipe.id));

    if (recipeIngredients.length === 0) {
      continue;
    }

    if (hasAllergyConflict(recipeIngredients, foodsMap, allergySet)) {
      continue;
    }

    const computedAggregate = computeRecipeAggregate(recipeIngredients, foodsMap);
    const existingAggregate = await getRecipeAggregate(safeRecipe.id);
    const candidateAggregate = normalizeAggregate(existingAggregate, safeRecipe, recipeIngredients, computedAggregate);

    const finalAggregate = {
      ...candidateAggregate,
      recipe_id: toSafeString(safeRecipe.id, candidateAggregate.recipe_id),
      name: toSafeString(safeRecipe.name, candidateAggregate.name),
      category: toSafeString(safeRecipe.category, candidateAggregate.category),
      ingredients: computedAggregate.ingredients,
      aggregation_basis: "per_serving",
      version: "RecipeAggregate_v1",
      schema_version: 1,
      compatibility: "backward",
    };

    const isValid = validateRecipeAggregate(finalAggregate);

    if (isValid) {
      output.push(finalAggregate);
    }
  }

  return output;
}

module.exports = {
  getValidRecipes,
};
