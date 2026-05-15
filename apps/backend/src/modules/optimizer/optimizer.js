const { toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");
const { extractCategories, extractFixedItems } = require("../../templates/mealTemplate.service");
const { buildGreedySolution } = require("./optimizer.greedy");
const { runBeamSearch } = require("./optimizer.beam");
const OPTIMIZER_CONFIG = require("../../config/optimizer");

function cloneFood(food) {
  if (!food || typeof food !== "object" || Array.isArray(food)) {
    return food;
  }

  const evaluation = food.evaluation && typeof food.evaluation === "object"
    ? food.evaluation
    : null;
  const triggeredRules = toSafeArray(evaluation && evaluation.triggeredRules);

  if (triggeredRules.length === 0) {
    return {
      ...food,
      evaluation: evaluation
        ? { ...evaluation, triggeredRules: [] }
        : {
          isValid: true,
          totalPenalty: 0,
          triggeredRules: [],
        },
      breakdown: food.breakdown && typeof food.breakdown === "object"
        ? { ...food.breakdown }
        : {},
    };
  }

  return {
    ...food,
    evaluation: {
      ...evaluation,
      triggeredRules: triggeredRules.map((rule) => ({ ...rule })),
    },
    breakdown: food.breakdown && typeof food.breakdown === "object"
      ? { ...food.breakdown }
      : {},
  };
}

function buildCategoryEntries(template, candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const categories = extractCategories(template);

  return categories.map((category, index) => ({
    key: `${category}__${index}`,
    category,
    foods: toSafeArray(safeCandidates[category]),
  }));
}

function getMealNames(fixedItems, selectedFoods) {
  const flexibleItems = selectedFoods
    .map((food) => (food && typeof food.name === "string" ? food.name : ""))
    .filter(Boolean);

  return [...fixedItems, ...flexibleItems];
}

function getTotalDiversityPenalty(selectedFoods) {
  const penalty = selectedFoods.reduce((total, food) => {
    const diversityPenalty = food ? toSafeNumber(food.diversityPenalty, 0) : 0;
    return total + diversityPenalty;
  }, 0);

  return Number(penalty.toFixed(3));
}

function getCategoriesUsed(categoryEntries, selectedCount) {
  const usedEntries = categoryEntries.slice(0, selectedCount);

  return Array.from(new Set(usedEntries
    .map((entry) => (entry && typeof entry.category === "string" ? entry.category : ""))
    .filter(Boolean)));
}

function getCombinationCount(categoryEntries) {
  if (categoryEntries.some((entry) => toSafeArray(entry && entry.foods).length === 0)) {
    return 0;
  }

  const product = categoryEntries.reduce((total, entry) => {
    const count = toSafeArray(entry && entry.foods).length;
    return total * count;
  }, 1);

  return Number.isFinite(product) ? product : 0;
}

function attachStats(result, stats) {
  const safeResult = result && typeof result === "object" ? result : {};
  Object.defineProperty(safeResult, "__stageStats", {
    value: {
      inputCount: Math.max(0, Math.trunc(toSafeNumber(stats.inputCount, 0))),
      outputCount: Math.max(0, Math.trunc(toSafeNumber(stats.outputCount, 0))),
      combinationsEvaluated: Math.max(0, Math.trunc(toSafeNumber(stats.combinationsEvaluated, 0))),
      selectedScore: Math.max(0, Math.min(1, toSafeNumber(stats.selectedScore, 0))),
      secondBestScore: Math.max(0, Math.min(1, toSafeNumber(stats.secondBestScore, 0))),
      reason: "optimizer_selection",
    },
    enumerable: false,
    writable: false,
  });

  return safeResult;
}

function createEmptyResult(fixedItems, categoryEntries) {
  const result = {
    meal: [],
    score: 0,
    breakdown: {
      items: [],
      totalScore: 0,
      meta: {
        fixedItems: [...fixedItems],
        flexibleCategories: categoryEntries.map((entry) => entry.category),
        categoriesUsed: [],
        totalPenalty: 0,
        totalDiversityPenalty: 0,
        combinationCount: 0,
      },
    },
  };

  return attachStats(result, {
    inputCount: categoryEntries.reduce((sum, entry) => sum + toSafeArray(entry.foods).length, 0),
    outputCount: 0,
    combinationsEvaluated: 0,
    selectedScore: 0,
  });
}

function buildCandidatesByCategory(categoryEntries) {
  return categoryEntries.reduce((acc, entry) => {
    acc[entry.key] = toSafeArray(entry.foods);
    return acc;
  }, {});
}

function hasCompleteSelection(solution, requiredCount) {
  const safeSolution = solution && typeof solution === "object" ? solution : {};
  const items = toSafeArray(safeSolution.items);

  return items.length === requiredCount;
}

function optimizeMeal(template, candidates) {
  const fixedItems = extractFixedItems(template);
  const categoryEntries = buildCategoryEntries(template, candidates);

  if (categoryEntries.some((entry) => entry.foods.length === 0)) {
    return createEmptyResult(fixedItems, categoryEntries);
  }

  const candidatesByCategory = buildCandidatesByCategory(categoryEntries);
  const greedySolution = buildGreedySolution(candidatesByCategory);
  const beamSolution = runBeamSearch(candidatesByCategory, OPTIMIZER_CONFIG.beamWidth, OPTIMIZER_CONFIG);

  let selectedSolution = beamSolution;

  if (!hasCompleteSelection(beamSolution, categoryEntries.length)) {
    selectedSolution = OPTIMIZER_CONFIG.useGreedyFallback ? greedySolution : beamSolution;
  }

  if (!hasCompleteSelection(selectedSolution, categoryEntries.length)) {
    return createEmptyResult(fixedItems, categoryEntries);
  }

  const selectedFoods = toSafeArray(selectedSolution.items).map((item) => cloneFood(item)).filter(Boolean);
  const totalScore = Number(toSafeNumber(selectedSolution.totalScore, 0).toFixed(3));
  const totalPenalty = Number(toSafeNumber(selectedSolution.totalPenalty, 0).toFixed(3));
  const totalDiversityPenalty = getTotalDiversityPenalty(selectedFoods);
  const categoriesUsed = getCategoriesUsed(categoryEntries, selectedFoods.length);
  const combinationCount = getCombinationCount(categoryEntries);

  const result = {
    meal: getMealNames(fixedItems, selectedFoods),
    score: totalScore,
    breakdown: {
      items: selectedFoods,
      totalScore,
      meta: {
        fixedItems: [...fixedItems],
        flexibleCategories: categoryEntries.map((entry) => entry.category),
        categoriesUsed,
        totalPenalty,
        totalDiversityPenalty,
        combinationCount,
      },
    },
  };

  return attachStats(result, {
    inputCount: categoryEntries.reduce((sum, entry) => sum + toSafeArray(entry.foods).length, 0),
    outputCount: selectedFoods.length > 0 ? 1 : 0,
    combinationsEvaluated: combinationCount,
    selectedScore: totalScore,
    secondBestScore: toSafeNumber(selectedSolution.secondBestScore, 0),
  });
}

module.exports = {
  optimizeMeal,
};

