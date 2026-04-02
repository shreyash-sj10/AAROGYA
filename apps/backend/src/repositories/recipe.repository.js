const recipeStore = require("../modules/recipe/recipe.repository");

const adapterInfo = Object.freeze({
  adapter: "in_memory",
  source: "modules.recipe.inMemoryStore",
  persistence: "none",
});

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

async function getRecipeById(recipeId) {
  return clone(await recipeStore.getRecipeById(toSafeString(recipeId, "")));
}

async function listRecipesByCategory(category) {
  return clone(await recipeStore.getRecipesByCategory(toSafeString(category, "")));
}

async function getRecipeIngredients(recipeId) {
  return clone(await recipeStore.getRecipeIngredients(toSafeString(recipeId, "")));
}

async function getRecipeAggregate(recipeId) {
  return clone(await recipeStore.getRecipeAggregate(toSafeString(recipeId, "")));
}

module.exports = {
  adapterInfo,
  getRecipeById,
  listRecipesByCategory,
  getRecipeIngredients,
  getRecipeAggregate,
};
