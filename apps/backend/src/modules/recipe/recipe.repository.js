const { toSafeString, toSafeArray } = require("../../utils/safeUtils");

const inMemoryStore = {
  recipes: [],
  recipeIngredients: [],
  recipeAggregates: [],
};

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function getStore() {
  return inMemoryStore;
}

function readRecipesByCategory(category) {
  const targetCategory = toSafeString(category);
  const { recipes } = getStore();

  const filtered = toSafeArray(recipes).filter((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.category === targetCategory;
  });

  return clonePlain(filtered);
}

function readRecipeIngredients(recipe_id) {
  const recipeId = toSafeString(recipe_id);
  const { recipeIngredients } = getStore();

  const filtered = toSafeArray(recipeIngredients).filter((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.recipe_id === recipeId;
  });

  return clonePlain(filtered);
}

function readRecipeAggregate(recipe_id) {
  const recipeId = toSafeString(recipe_id);
  const { recipeAggregates } = getStore();

  const aggregate = toSafeArray(recipeAggregates).find((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.recipe_id === recipeId;
  }) || null;

  return clonePlain(aggregate);
}

/**
 * Deterministic in-memory recipes: one recipe per catalog food (Phase 5 recipe-first).
 * Idempotent per process (skips existing synth_* ids).
 */
function upsertSyntheticRecipesFromFoods(foods) {
  const store = getStore();
  const existingIds = new Set(
    toSafeArray(store.recipes).map((r) => toSafeString(r && typeof r === "object" ? r.id : "")).filter(Boolean)
  );

  toSafeArray(foods).forEach((food) => {
    if (!food || typeof food !== "object") {
      return;
    }

    const fid = toSafeString(food.id);
    const cat = toSafeString(food.category);
    if (!fid || !cat) {
      return;
    }

    const rid = `synth_${fid}`;
    if (existingIds.has(rid)) {
      return;
    }

    existingIds.add(rid);
    const name = typeof food.name === "string" && food.name.trim() ? food.name.trim() : fid;
    const isVeg = food.meta && typeof food.meta.is_vegetarian === "boolean" ? food.meta.is_vegetarian : true;

    store.recipes.push({
      id: rid,
      name,
      category: cat,
      is_vegetarian: isVeg,
    });

    store.recipeIngredients.push({
      recipe_id: rid,
      food_id: fid,
      quantity_grams: 100,
    });
  });
}

async function getRecipeById(recipe_id) {
  const recipeId = toSafeString(recipe_id);
  const { recipes } = getStore();

  const recipe = toSafeArray(recipes).find((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.id === recipeId;
  }) || null;

  return clonePlain(recipe);
}

async function getRecipesByCategory(category) {
  return readRecipesByCategory(category);
}

async function getRecipeIngredients(recipe_id) {
  return readRecipeIngredients(recipe_id);
}

async function getRecipeAggregate(recipe_id) {
  return readRecipeAggregate(recipe_id);
}

module.exports = {
  getRecipeById,
  getRecipesByCategory,
  getRecipeIngredients,
  getRecipeAggregate,
  readRecipesByCategory,
  readRecipeIngredients,
  readRecipeAggregate,
  upsertSyntheticRecipesFromFoods,
};
