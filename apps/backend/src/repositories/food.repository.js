const Ajv = require("ajv");
const pg = require("../services/db/pg.service");
const { foodSchema } = require("../modules/food/food.schema");
const { sampleFoods } = require("../modules/food/food.samples");

const SOURCE_DB = "DB";
const SOURCE_FALLBACK = "fallback";
const REQUIRE_DB = process.env.REQUIRE_DB === "true";

let cachedFoods = null;
let foodsSource = SOURCE_FALLBACK;
let refreshInFlight = null;

const ajv = new Ajv({ allErrors: true, strict: true, useDefaults: true });
const validateFoodSchema = ajv.compile(foodSchema);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateFood(payload) {
  const candidate = clone(payload);
  const valid = validateFoodSchema(candidate);
  return valid ? candidate : null;
}

function normalizeFoodRecord(row) {
  const payload = row && typeof row.payload === "object" ? row.payload : null;
  if (!payload) return null;
  return validateFood(payload);
}

function useFallbackFoods(reason = "DB failure") {
  if (REQUIRE_DB) {
    throw new Error(`[DATA SOURCE] fallback blocked by REQUIRE_DB (foods): ${reason}`);
  }

  console.warn(`[DATA SOURCE] foods: fallback (DB failure: ${reason})`);
  cachedFoods = sampleFoods.map((item) => Object.freeze(clone(item)));
  foodsSource = SOURCE_FALLBACK;
  return cachedFoods;
}

async function refreshFoodsFromDb() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!pg.isDbEnabled()) {
      return useFallbackFoods("db_not_enabled");
    }

    try {
      const result = await pg.query("SELECT payload FROM food_catalog ORDER BY id ASC", []);
      const rows = Array.isArray(result && result.rows) ? result.rows : [];
      const dbFoods = rows.map(normalizeFoodRecord).filter(Boolean).map((item) => Object.freeze(clone(item)));

      if (dbFoods.length === 0) {
        console.error("[DATA ERROR] empty DB result for foods");
        throw new Error("[DATA ERROR] empty DB result for foods");
      }

      cachedFoods = dbFoods;
      foodsSource = SOURCE_DB;
      console.info("[DATA SOURCE] foods: DB");
      return cachedFoods;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message.includes("[DATA ERROR] empty DB result for foods")) {
        throw error;
      }
      return useFallbackFoods(message);
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function getFoods() {
  if (!Array.isArray(cachedFoods) || cachedFoods.length === 0) {
    if (!pg.isDbEnabled()) {
      useFallbackFoods("lazy_sync_bootstrap");
    } else {
      throw new Error("Foods cache is empty. Repository bootstrap did not complete.");
    }
  }
  return clone(cachedFoods);
}

function getFoodsSource() {
  return foodsSource;
}

async function initializeFoodRepository() {
  await refreshFoodsFromDb();
}

module.exports = {
  getFoods,
  getFoodsSource,
  refreshFoodsFromDb,
  initializeFoodRepository,
};
