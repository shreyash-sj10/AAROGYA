const Ajv = require("ajv");

const { FOOD_CATEGORIES, foodSchema } = require("./food.schema");
const { sampleFoods } = require("./food.samples");

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  useDefaults: true,
});

const validateFoodSchema = ajv.compile(foodSchema);

function buildValidationError(errors = []) {
  const details = errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message,
    keyword: error.keyword,
    params: error.params,
  }));

  const validationError = new Error("Food validation failed");
  validationError.name = "FoodValidationError";
  validationError.details = details;
  return validationError;
}

function normalizeFood(food) {
  const source = food && typeof food === "object" ? food : {};
  const ayurveda = source.ayurveda && typeof source.ayurveda === "object" ? source.ayurveda : {};
  const doshaEffect = source.dosha_effect && typeof source.dosha_effect === "object" ? source.dosha_effect : {};
  const functional = source.functional && typeof source.functional === "object" ? source.functional : {};
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  const extra = source.extra && typeof source.extra === "object" ? source.extra : {};

  return {
    ...source,
    ayurveda: {
      ...ayurveda,
      rasa: Array.isArray(ayurveda.rasa) ? [...ayurveda.rasa] : [],
      guna: Array.isArray(ayurveda.guna) ? [...ayurveda.guna] : [],
    },
    dosha_effect: {
      vata: typeof doshaEffect.vata === "number" && Number.isFinite(doshaEffect.vata) ? doshaEffect.vata : 0,
      pitta: typeof doshaEffect.pitta === "number" && Number.isFinite(doshaEffect.pitta) ? doshaEffect.pitta : 0,
      kapha: typeof doshaEffect.kapha === "number" && Number.isFinite(doshaEffect.kapha) ? doshaEffect.kapha : 0,
    },
    functional: {
      digestibility_score:
        typeof functional.digestibility_score === "number" && Number.isFinite(functional.digestibility_score)
          ? functional.digestibility_score
          : 0.5,
      heaviness_score:
        typeof functional.heaviness_score === "number" && Number.isFinite(functional.heaviness_score)
          ? functional.heaviness_score
          : 0.5,
    },
    seasonality: Array.isArray(source.seasonality) ? [...source.seasonality] : [],
    meta: {
      is_vegetarian: typeof meta.is_vegetarian === "boolean" ? meta.is_vegetarian : true,
    },
    extra: { ...extra },
  };
}

function validateFood(food) {
  const normalizedFood = normalizeFood(food);
  const isValid = validateFoodSchema(normalizedFood);

  if (!isValid) {
    return {
      valid: false,
      isValid: false,
      errors: buildValidationError(validateFoodSchema.errors).details,
      food: normalizedFood,
    };
  }

  return {
    valid: true,
    isValid: true,
    errors: [],
    food: normalizedFood,
  };
}

let cachedFoods;

function loadAllFoods() {
  if (cachedFoods) {
    return cachedFoods;
  }

  cachedFoods = sampleFoods.map((food) => {
    const result = validateFood(food);

    if (!result.valid) {
      const validationError = new Error(`Invalid food \"${food && food.id ? food.id : "unknown"}\"`);
      validationError.name = "FoodValidationError";
      validationError.details = result.errors;
      throw validationError;
    }

    return Object.freeze(result.food);
  });

  return cachedFoods;
}

function loadSampleFoods() {
  return loadAllFoods();
}

function getFoodsByCategory(category) {
  if (!FOOD_CATEGORIES.includes(category)) {
    throw new Error(
      `Invalid food category \"${category}\". Allowed categories: ${FOOD_CATEGORIES.join(", ")}`
    );
  }

  return loadAllFoods().filter((food) => food.category === category);
}

module.exports = {
  foodSchema,
  getFoodsByCategory,
  loadAllFoods,
  loadSampleFoods,
  normalizeFood,
  validateFood,
};
