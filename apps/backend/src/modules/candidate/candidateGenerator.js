const { CANDIDATE_CONFIG } = require("../../config/candidate");
const { simulateEmptyCandidates } = require("../../config/devSimulations");
const FEATURE_FLAGS = require("../../config/featureFlags");
const { normalizeString, toSafeArray, toSafeNumber, toSafeObject, toSafeString } = require("../../utils/normalizeInput");
const { extractCategories } = require("../../templates/mealTemplate.service");
const { upsertSyntheticRecipesFromFoods } = require("../recipe/recipe.repository");
const { getValidRecipesSync } = require("../recipe/recipe.service");
const { applyRules } = require("../../rules/engine/constraintEngine");

function toSafeTopK(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return CANDIDATE_CONFIG.DEFAULT_TOP_K;
  }

  return Math.max(0, Math.floor(value));
}

function isVegetarianAllowed(userState, food) {
  const dietRaw = normalizeString(userState && (userState.diet || userState.diet_type));
  const diet = dietRaw === "veg" ? "vegetarian" : dietRaw;

  if (diet !== "vegetarian" && diet !== "vegan") {
    return true;
  }

  if (!food || !food.meta || typeof food.meta.is_vegetarian !== "boolean") {
    return true;
  }

  return food.meta.is_vegetarian === true;
}

function isAllergySafe(userState, food) {
  const allergies = toSafeArray(userState && userState.allergies)
    .map(normalizeString)
    .filter(Boolean);

  if (allergies.length === 0) {
    return true;
  }

  const foodName = normalizeString(food && food.name);
  const foodId = normalizeString(food && food.id);
  const foodCategory = normalizeString(food && food.category);
  const foodAllergens = toSafeArray(food && food.allergens).map(normalizeString);

  return !allergies.some((allergy) => (
    allergy === foodName
    || allergy === foodId
    || allergy === foodCategory
    || foodAllergens.includes(allergy)
  ));
}

function isExcluded(userState, food) {
  const exclusions = toSafeArray(userState && userState.exclusions)
    .map(normalizeString)
    .filter(Boolean);

  if (exclusions.length === 0) {
    return false;
  }

  const foodName = normalizeString(food && food.name);
  const foodId = normalizeString(food && food.id);
  const foodRecipeId = normalizeString(food && food.recipe_id);

  return exclusions.includes(foodName) || exclusions.includes(foodId) || exclusions.includes(foodRecipeId);
}
function applyPreFilters(foods, userState) {
  return toSafeArray(foods).filter((food) => isVegetarianAllowed(userState, food) && isAllergySafe(userState, food) && !isExcluded(userState, food));
}

function getDigestibilityScore(food) {
  if (food && food.functional && typeof food.functional.digestibility_score === "number" && Number.isFinite(food.functional.digestibility_score)) {
    return food.functional.digestibility_score;
  }

  if (food && typeof food.digestibility_score === "number" && Number.isFinite(food.digestibility_score)) {
    return food.digestibility_score;
  }

  return 0;
}

function getTotalPenalty(food) {
  return food && food.evaluation && typeof food.evaluation.totalPenalty === "number" && Number.isFinite(food.evaluation.totalPenalty)
    ? food.evaluation.totalPenalty
    : 0;
}

function computeScoreLite(food) {
  const digestibilityScore = getDigestibilityScore(food);
  const totalPenalty = getTotalPenalty(food);

  const scoreLite = digestibilityScore * (1 - totalPenalty);

  return Number(Math.max(0, scoreLite).toFixed(3));
}

function createCandidateBreakdown(food) {
  return {
    nutrition: 0,
    dosha: 0,
    digestibility: Number(getDigestibilityScore(food).toFixed(3)),
    familiarity: 0,
    penalty: Number(getTotalPenalty(food).toFixed(3)),
  };
}

function compareCandidates(leftFood, rightFood) {
  if (rightFood.scoreLite !== leftFood.scoreLite) {
    return rightFood.scoreLite - leftFood.scoreLite;
  }

  const leftPenalty = getTotalPenalty(leftFood);
  const rightPenalty = getTotalPenalty(rightFood);

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  const leftName = typeof leftFood.name === "string" ? leftFood.name : "";
  const rightName = typeof rightFood.name === "string" ? rightFood.name : "";
  return leftName.localeCompare(rightName);
}

function createCandidateFood(food) {
  const evaluation = food && food.evaluation
    ? {
      ...food.evaluation,
      triggeredRules: toSafeArray(food.evaluation.triggeredRules).map((rule) => ({ ...rule })),
    }
    : {
      isValid: true,
      totalPenalty: 0,
      triggeredRules: [],
    };

  return {
    ...food,
    digestibility_score: getDigestibilityScore(food),
    evaluation,
    score: 0,
    finalScore: 0,
    breakdown: createCandidateBreakdown({ ...food, evaluation }),
    scoreLite: computeScoreLite({ ...food, evaluation }),
  };
}

function evaluateFoodWithRules(food, userState, rules) {
  const safeFood = food && typeof food === "object" ? food : {};
  const evaluation = applyRules(safeFood, userState, rules);

  return {
    ...safeFood,
    evaluation: {
      isValid: Boolean(evaluation && evaluation.isValid),
      totalPenalty: Number(evaluation && typeof evaluation.totalPenalty === "number" ? evaluation.totalPenalty : 0),
      triggeredRules: toSafeArray(evaluation && evaluation.triggeredRules).map((rule) => ({ ...rule })),
    },
  };
}

function buildFoodsMapFromList(foods) {
  return toSafeArray(foods).reduce((acc, food) => {
    const safe = toSafeObject(food);
    const id = toSafeString(safe.id, "");
    if (id) {
      acc[id] = safe;
    }
    return acc;
  }, {});
}

function gramsFromAggregateIngredient(ingredient) {
  const safe = toSafeObject(ingredient);
  const q = toSafeObject(safe.quantity);
  const unit = normalizeString(q.unit);
  if (unit === "grams" && typeof q.value === "number" && Number.isFinite(q.value)) {
    return q.value;
  }
  return 0;
}

function synthesizeDoshaEffectFromAggregate(aggregate, foodsMap) {
  const safeMap = foodsMap && typeof foodsMap === "object" ? foodsMap : {};
  let totalGrams = 0;
  const sum = { vata: 0, pitta: 0, kapha: 0 };

  toSafeArray(aggregate && aggregate.ingredients).forEach((ing) => {
    const fid = toSafeString(toSafeObject(ing).food_id, "");
    const g = gramsFromAggregateIngredient(ing);
    const food = toSafeObject(safeMap[fid]);
    if (!food || g <= 0) {
      return;
    }
    const d = toSafeObject(food.dosha_effect);
    totalGrams += g;
    sum.vata += toSafeNumber(d.vata, 0) * g;
    sum.pitta += toSafeNumber(d.pitta, 0) * g;
    sum.kapha += toSafeNumber(d.kapha, 0) * g;
  });

  if (totalGrams <= 0) {
    const de = toSafeObject(toSafeObject(aggregate && aggregate.aggregates).dosha_estimate);
    return {
      vata: toSafeNumber(de.vata, 0),
      pitta: toSafeNumber(de.pitta, 0),
      kapha: toSafeNumber(de.kapha, 0),
    };
  }

  return {
    vata: sum.vata / totalGrams,
    pitta: sum.pitta / totalGrams,
    kapha: sum.kapha / totalGrams,
  };
}

function recipeAggregateToFoodCandidate(aggregate, foodsMap, slotCategory) {
  const agg = aggregate && typeof aggregate === "object" ? aggregate : {};
  const aggregates = toSafeObject(agg.aggregates);
  const nutr = toSafeObject(aggregates.nutrition);
  const func = toSafeObject(aggregates.functional);
  const safeMap = foodsMap && typeof foodsMap === "object" ? foodsMap : {};
  const allergenSet = new Set();
  const tagSet = new Set();
  let allergyTag = "";
  let allVegetarian = true;

  toSafeArray(agg.ingredients).forEach((ing) => {
    const fid = toSafeString(toSafeObject(ing).food_id, "");
    const food = toSafeObject(safeMap[fid]);
    toSafeArray(food.allergens).forEach((a) => {
      const s = normalizeString(a);
      if (s) {
        allergenSet.add(s);
      }
    });
    toSafeArray(food.tags).forEach((t) => {
      const s = normalizeString(t);
      if (s) {
        tagSet.add(s);
      }
    });
    const meta = toSafeObject(food.meta);
    if (typeof meta.allergy_tag === "string" && meta.allergy_tag.trim() && !allergyTag) {
      allergyTag = meta.allergy_tag.trim();
    }
    if (meta.is_vegetarian === false) {
      allVegetarian = false;
    }
  });

  const recipeId = toSafeString(agg.recipe_id, "");
  const name = typeof agg.name === "string" && agg.name.trim() ? agg.name.trim() : recipeId;

  const metaOut = { is_vegetarian: allVegetarian };
  if (allergyTag) {
    metaOut.allergy_tag = allergyTag;
  }

  return {
    id: recipeId,
    recipe_id: recipeId,
    name,
    category: slotCategory,
    nutrition: {
      calories: toSafeNumber(nutr.calories, 0),
      protein: toSafeNumber(nutr.protein, 0),
      carbs: toSafeNumber(nutr.carbs, 0),
      fat: toSafeNumber(nutr.fat, 0),
      glycemic_index: toSafeNumber(nutr.glycemic_index, 0),
    },
    dosha_effect: synthesizeDoshaEffectFromAggregate(agg, safeMap),
    functional: {
      digestibility_score: toSafeNumber(func.digestibility_score, 0),
      heaviness_score: toSafeNumber(func.heaviness_score, 0),
    },
    meta: metaOut,
    allergens: Array.from(allergenSet),
    tags: Array.from(tagSet),
    recipe_aggregate: agg,
  };
}

function generateCandidates(template, foods, userState, rules, options) {
  const safeFoods = toSafeArray(foods);
  const safeOptions = options && typeof options === "object" ? options : {};
  const topK = toSafeTopK(safeOptions.topK);
  const categories = Array.from(new Set(extractCategories(template)));

  if (simulateEmptyCandidates()) {
    const emptyMap = categories.reduce((acc, category) => {
      acc[category] = [];
      return acc;
    }, {});
    const stageStats = {
      inputCount: safeFoods.length,
      outputCount: 0,
      rejectedCount: safeFoods.length,
      reason: "SIMULATE_EMPTY_CANDIDATES",
    };
    Object.defineProperty(emptyMap, "__stageStats", {
      value: stageStats,
      enumerable: false,
      writable: false,
    });
    return emptyMap;
  }

  const stageStats = {
    inputCount: safeFoods.length,
    outputCount: 0,
    rejectedCount: 0,
    reason: "candidate_prefilter",
  };

  if (FEATURE_FLAGS.recipeFirstPipelineEnabled()) {
    upsertSyntheticRecipesFromFoods(safeFoods);
  }

  const foodsMapForRecipes = buildFoodsMapFromList(safeFoods);

  const candidateMap = categories.reduce((acc, category) => {
    let categoryFoods = safeFoods.filter((food) => food && food.category === category);

    if (FEATURE_FLAGS.recipeFirstPipelineEnabled()) {
      const aggregates = getValidRecipesSync({
        category,
        foods: safeFoods,
        userState,
      });
      if (aggregates.length > 0) {
        categoryFoods = aggregates.map((aggregate) => recipeAggregateToFoodCandidate(
          aggregate,
          foodsMapForRecipes,
          category
        ));
      }
    }

    const preFilteredFoods = applyPreFilters(categoryFoods, userState);
    const ruleEvaluatedFoods = preFilteredFoods
      .map((food) => evaluateFoodWithRules(food, userState, rules))
      .filter((food) => food.evaluation.isValid);

    const prepared = ruleEvaluatedFoods
      .map(createCandidateFood)
      .sort(compareCandidates)
      .slice(0, topK > 0 ? topK : undefined);

    acc[category] = prepared;
    stageStats.outputCount += prepared.length;
    stageStats.rejectedCount += Math.max(0, categoryFoods.length - prepared.length);

    return acc;
  }, {});

  Object.defineProperty(candidateMap, "__stageStats", {
    value: stageStats,
    enumerable: false,
    writable: false,
  });

  return candidateMap;
}

function generateRecipeCandidates(context) {
  return getValidRecipesSync(context);
}

module.exports = {
  applyPreFilters,
  computeScoreLite,
  compareCandidates,
  createCandidateFood,
  generateCandidates,
  generateRecipeCandidates,
};



