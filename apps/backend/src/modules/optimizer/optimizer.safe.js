const { optimizeMeal } = require("./optimizer");
const { buildGreedySolution } = require("./optimizer.greedy");
const { extractCategories, extractFixedItems } = require("../../templates/mealTemplate.service");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isValidOptimizerResult(result) {
  const safe = toSafeObject(result);
  const meal = toSafeArray(safe.meal);
  const breakdown = toSafeObject(safe.breakdown);
  const items = toSafeArray(breakdown.items);

  return meal.length > 0 && items.length > 0;
}

function toSafeCandidateMap(template, candidates) {
  const safeCandidates = toSafeObject(candidates);
  const categories = toSafeArray(extractCategories(template));

  return categories.reduce((acc, category) => {
    acc[category] = toSafeArray(safeCandidates[category]);
    return acc;
  }, {});
}

function buildResultFromGreedy(template, greedySolution) {
  const safeTemplate = toSafeObject(template);
  const fixedItems = toSafeArray(extractFixedItems(safeTemplate));
  const safeGreedy = toSafeObject(greedySolution);
  const items = toSafeArray(safeGreedy.items).map((item) => ({ ...toSafeObject(item) }));
  const mealNames = items
    .map((item) => (typeof item.name === "string" ? item.name : ""))
    .filter(Boolean);

  return {
    meal: [...fixedItems, ...mealNames],
    score: Number(toSafeNumber(safeGreedy.totalScore, 0).toFixed(3)),
    breakdown: {
      items,
      totalScore: Number(toSafeNumber(safeGreedy.totalScore, 0).toFixed(3)),
      meta: {
        fixedItems,
        flexibleCategories: toSafeArray(extractCategories(safeTemplate)),
        categoriesUsed: toSafeArray(extractCategories(safeTemplate)),
        totalPenalty: Number(toSafeNumber(safeGreedy.totalPenalty, 0).toFixed(3)),
        totalDiversityPenalty: 0,
        combinationCount: 0,
      },
    },
  };
}

function runSafeOptimizer(input) {
  const safeInput = toSafeObject(input);
  const template = toSafeObject(safeInput.template);
  const candidates = toSafeObject(safeInput.candidates);
  const inputCount = Object.keys(candidates).reduce((sum, category) => sum + toSafeArray(candidates[category]).length, 0);

  try {
    const optimized = optimizeMeal(template, candidates);

    if (isValidOptimizerResult(optimized)) {
      return {
        result: optimized,
        usedFallback: false,
        reason: null,
        stats: {
          inputCount,
          outputCount: toSafeArray(toSafeObject(optimized.breakdown).items).length,
          rejectedCount: Math.max(0, inputCount - toSafeArray(toSafeObject(optimized.breakdown).items).length),
          reason: "optimizer_selected",
        },
      };
    }
  } catch (error) {
    // Greedy fallback is handled below.
  }

  const greedy = buildGreedySolution(toSafeCandidateMap(template, candidates));
  const greedyResult = buildResultFromGreedy(template, greedy);

  return {
    result: greedyResult,
    usedFallback: true,
    reason: "OPTIMIZER_FAILURE",
    stats: {
      inputCount,
      outputCount: toSafeArray(toSafeObject(greedyResult.breakdown).items).length,
      rejectedCount: Math.max(0, inputCount - toSafeArray(toSafeObject(greedyResult.breakdown).items).length),
      reason: "optimizer_fallback_greedy",
    },
  };
}

module.exports = {
  runSafeOptimizer,
};


