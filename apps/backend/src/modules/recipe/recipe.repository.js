const inMemoryStore = {
  recipes: [],
  recipeIngredients: [],
  recipeAggregates: [],
};

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeString(value) {
  return typeof value === "string" ? value : "";
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function getStore() {
  return inMemoryStore;
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
  const targetCategory = toSafeString(category);
  const { recipes } = getStore();

  const filtered = toSafeArray(recipes).filter((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.category === targetCategory;
  });

  return clonePlain(filtered);
}

async function getRecipeIngredients(recipe_id) {
  const recipeId = toSafeString(recipe_id);
  const { recipeIngredients } = getStore();

  const filtered = toSafeArray(recipeIngredients).filter((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.recipe_id === recipeId;
  });

  return clonePlain(filtered);
}

async function getRecipeAggregate(recipe_id) {
  const recipeId = toSafeString(recipe_id);
  const { recipeAggregates } = getStore();

  const aggregate = toSafeArray(recipeAggregates).find((item) => {
    const candidate = item && typeof item === "object" ? item : {};
    return candidate.recipe_id === recipeId;
  }) || null;

  return clonePlain(aggregate);
}

module.exports = {
  getRecipeById,
  getRecipesByCategory,
  getRecipeIngredients,
  getRecipeAggregate,
};
