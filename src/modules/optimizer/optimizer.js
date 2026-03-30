const { toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");
const { extractCategories, extractFixedItems } = require("../templates/mealTemplate.service");

function cloneFood(food) {
  if (!food || typeof food !== "object" || Array.isArray(food)) {
    return food;
  }

  return {
    ...food,
    evaluation: food.evaluation && typeof food.evaluation === "object"
      ? {
        ...food.evaluation,
        triggeredRules: toSafeArray(food.evaluation.triggeredRules).map((rule) => ({ ...rule })),
      }
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

function buildCategoryEntries(template, candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const categories = extractCategories(template);

  return categories.map((category, index) => ({
    key: `${category}__${index}`,
    category,
    foods: toSafeArray(safeCandidates[category]),
  }));
}

function generateCombinations(categoryEntries, index, currentSelection, combinations) {
  if (index >= categoryEntries.length) {
    combinations.push([...currentSelection]);
    return;
  }

  const entry = categoryEntries[index];

  if (entry.foods.length === 0) {
    return;
  }

  entry.foods.forEach((food) => {
    currentSelection.push({
      categoryKey: entry.key,
      category: entry.category,
      food,
    });
    generateCombinations(categoryEntries, index + 1, currentSelection, combinations);
    currentSelection.pop();
  });
}

function getMealNames(fixedItems, selections) {
  const flexibleItems = selections
    .map((selection) => (selection && selection.food && typeof selection.food.name === "string" ? selection.food.name : ""))
    .filter(Boolean);

  return [...fixedItems, ...flexibleItems];
}

function getSelectedFoods(selections) {
  return selections
    .map((selection) => cloneFood(selection && selection.food))
    .filter(Boolean);
}

function getTotalPenalty(selections) {
  const penalty = selections.reduce((total, selection) => {
    const foodPenalty = selection && selection.food && selection.food.evaluation
      ? toSafeNumber(selection.food.evaluation.totalPenalty, 0)
      : 0;

    return total + foodPenalty;
  }, 0);

  return Number(penalty.toFixed(3));
}

function getTotalDiversityPenalty(selections) {
  const penalty = selections.reduce((total, selection) => {
    const diversityPenalty = selection && selection.food
      ? toSafeNumber(selection.food.diversityPenalty, 0)
      : 0;

    return total + diversityPenalty;
  }, 0);

  return Number(penalty.toFixed(3));
}

function getMealScore(selections) {
  const score = selections.reduce((total, selection) => {
    const foodScore = selection && selection.food
      ? toSafeNumber(selection.food.finalScore, toSafeNumber(selection.food.score, 0))
      : 0;

    return total + foodScore;
  }, 0);

  return Number(score.toFixed(3));
}

function getCategoriesUsed(selections) {
  return Array.from(new Set(selections
    .map((selection) => (selection && typeof selection.category === "string" ? selection.category : ""))
    .filter(Boolean)));
}

function compareAlphabetical(leftItems, rightItems) {
  const leftValue = [...leftItems].sort((left, right) => left.localeCompare(right)).join("|");
  const rightValue = [...rightItems].sort((left, right) => left.localeCompare(right)).join("|");
  return leftValue.localeCompare(rightValue);
}

function createEmptyResult(fixedItems, categoryEntries) {
  return {
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
}

function optimizeMeal(template, candidates) {
  const fixedItems = extractFixedItems(template);
  const categoryEntries = buildCategoryEntries(template, candidates);

  if (categoryEntries.some((entry) => entry.foods.length === 0)) {
    return createEmptyResult(fixedItems, categoryEntries);
  }

  const combinations = [];
  generateCombinations(categoryEntries, 0, [], combinations);

  let bestResult = null;

  combinations.forEach((selection) => {
    const meal = getMealNames(fixedItems, selection);
    const selectedFoods = getSelectedFoods(selection);
    const totalScore = getMealScore(selection);
    const totalPenalty = getTotalPenalty(selection);
    const totalDiversityPenalty = getTotalDiversityPenalty(selection);
    const categoriesUsed = getCategoriesUsed(selection);
    const candidateResult = {
      meal,
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
          combinationCount: combinations.length,
        },
      },
    };

    if (!bestResult) {
      bestResult = candidateResult;
      return;
    }

    if (candidateResult.score > bestResult.score) {
      bestResult = candidateResult;
      return;
    }

    if (candidateResult.score < bestResult.score) {
      return;
    }

    if (candidateResult.breakdown.meta.totalPenalty < bestResult.breakdown.meta.totalPenalty) {
      bestResult = candidateResult;
      return;
    }

    if (candidateResult.breakdown.meta.totalPenalty > bestResult.breakdown.meta.totalPenalty) {
      return;
    }

    if (compareAlphabetical(candidateResult.meal, bestResult.meal) < 0) {
      bestResult = candidateResult;
    }
  });

  return bestResult || createEmptyResult(fixedItems, categoryEntries);
}

module.exports = {
  optimizeMeal,
};
