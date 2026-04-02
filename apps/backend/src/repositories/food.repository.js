const { loadAllFoods, getFoodsByCategory, validateFood } = require("../modules/food");

const adapterInfo = Object.freeze({
  adapter: "in_memory",
  source: "modules.food.sampleFoods",
  persistence: "none",
});

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function listFoods() {
  return clone(loadAllFoods());
}

async function getFoodById(foodId) {
  const id = toSafeString(foodId, "");
  if (!id) {
    return null;
  }

  const match = loadAllFoods().find((food) => toSafeString(food && food.id, "") === id) || null;
  return match ? clone(match) : null;
}

async function listFoodsByCategory(category) {
  const safeCategory = toSafeString(category, "");
  if (!safeCategory) {
    return [];
  }

  return clone(getFoodsByCategory(safeCategory));
}

async function validateFoodRecord(food) {
  const result = validateFood(food);
  return clone(result);
}

module.exports = {
  adapterInfo,
  listFoods,
  getFoodById,
  listFoodsByCategory,
  validateFoodRecord,
};
