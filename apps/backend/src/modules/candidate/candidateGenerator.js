const { CANDIDATE_CONFIG } = require("../../config/candidate");
const { normalizeString, toSafeArray } = require("../../utils/normalizeInput");
const { extractCategories } = require("../../templates/mealTemplate.service");
const { getValidRecipes } = require("../recipe/recipe.service");
const { applyRules } = require("../../rules/engine/constraintEngine");

function toSafeTopK(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return CANDIDATE_CONFIG.DEFAULT_TOP_K;
  }

  return Math.max(0, Math.floor(value));
}

function isVegetarianAllowed(userState, food) {
  const diet = normalizeString(userState && (userState.diet || userState.diet_type));

  if (diet !== "veg") {
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

function applyPreFilters(foods, userState) {
  return toSafeArray(foods).filter((food) => isVegetarianAllowed(userState, food) && isAllergySafe(userState, food));
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

function generateCandidates(template, foods, userState, rules, options) {
  const safeFoods = toSafeArray(foods);
  const safeOptions = options && typeof options === "object" ? options : {};
  const topK = toSafeTopK(safeOptions.topK);
  const categories = Array.from(new Set(extractCategories(template)));

  const stageStats = {
    inputCount: safeFoods.length,
    outputCount: 0,
    rejectedCount: 0,
    reason: "candidate_prefilter",
  };

  const candidateMap = categories.reduce((acc, category) => {
    const categoryFoods = safeFoods.filter((food) => food && food.category === category);
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

async function generateRecipeCandidates(context) {
  const recipes = await getValidRecipes(context);
  return toSafeArray(recipes);
}

module.exports = {
  applyPreFilters,
  computeScoreLite,
  compareCandidates,
  createCandidateFood,
  generateCandidates,
  generateRecipeCandidates,
};
