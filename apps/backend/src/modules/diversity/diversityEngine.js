const { DIVERSITY_CONFIG } = require("../../config/diversity");
const { normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeCategoryCounts(left, right) {
  const safeLeft = toSafeObject(left);
  const safeRight = toSafeObject(right);
  const merged = { ...safeLeft };

  Object.keys(safeRight).forEach((key) => {
    merged[key] = toSafeNumber(safeLeft[key], 0) + toSafeNumber(safeRight[key], 0);
  });

  return merged;
}

function collectMultiDayHistory(history) {
  const safeHistory = toSafeObject(history);
  const directFoods = toSafeArray(safeHistory.recentFoods).map(normalizeString).filter(Boolean);
  const directCategories = toSafeObject(safeHistory.categoryCount);
  const days = toSafeArray(safeHistory.multiDayHistory || safeHistory.dayHistory);

  const multiDayFoods = [];
  const multiDayCategories = {};
  const mealsByDay = [];

  days.forEach((day, index) => {
    const safeDay = toSafeObject(day);
    const meals = toSafeArray(safeDay.meals);
    const normalizedMeals = [];

    meals.forEach((meal) => {
      const safeMeal = toSafeObject(meal);
      const name = normalizeString(safeMeal.name || safeMeal.recipe_id || safeMeal.id);
      const category = normalizeString(safeMeal.category);

      if (name) {
        multiDayFoods.push(name);
      }

      if (category) {
        multiDayCategories[category] = (multiDayCategories[category] || 0) + 1;
      }

      if (name || category) {
        normalizedMeals.push({ name, category, dayIndex: index });
      }
    });

    if (normalizedMeals.length > 0) {
      mealsByDay.push(normalizedMeals);
    }
  });

  return {
    foods: [...directFoods, ...multiDayFoods],
    categories: mergeCategoryCounts(directCategories, multiDayCategories),
    mealsByDay,
  };
}

function computeRecencyPenalty(foodName, recentFoods, recencyWindow) {
  if (!foodName) {
    return 0;
  }

  const safeWindow = Math.max(0, Math.trunc(toSafeNumber(recencyWindow, DIVERSITY_CONFIG.DEFAULT_RECENCY_WINDOW)));
  if (safeWindow === 0) {
    return 0;
  }

  const recentWindowFoods = toSafeArray(recentFoods).slice(0, safeWindow);
  const repeatCount = recentWindowFoods.reduce((count, item) => count + (item === foodName ? 1 : 0), 0);

  return Number((repeatCount * DIVERSITY_CONFIG.WEIGHTS.RECENCY_REPEAT).toFixed(6));
}

function computeMultiDayPenalty(foodName, mealsByDay) {
  if (!foodName) {
    return 0;
  }

  const repeatedDays = toSafeArray(mealsByDay).reduce((count, meals) => {
    const hasMatch = toSafeArray(meals).some((meal) => normalizeString(toSafeObject(meal).name) === foodName);
    return count + (hasMatch ? 1 : 0);
  }, 0);

  return Number((repeatedDays * DIVERSITY_CONFIG.WEIGHTS.MULTI_DAY_REPEAT).toFixed(6));
}

function computeRotationPenalty(foodCategory, userHistory) {
  const safeHistory = toSafeObject(userHistory);
  const rotationOrder = toSafeArray(safeHistory.categoryRotationOrder).map(normalizeString).filter(Boolean);
  const rotationIndex = Math.max(0, Math.trunc(toSafeNumber(safeHistory.rotationIndex, 0)));

  if (!foodCategory || rotationOrder.length === 0) {
    return 0;
  }

  const expectedCategory = rotationOrder[rotationIndex % rotationOrder.length];
  if (!expectedCategory) {
    return 0;
  }

  return expectedCategory === foodCategory ? 0 : DIVERSITY_CONFIG.WEIGHTS.ROTATION_MISMATCH;
}
function computeHistoricalPenalty(foodId, persistentHistory) {
  if (!foodId || !Array.isArray(persistentHistory) || persistentHistory.length === 0) {
    return { penalty: 0, matchCount: 0 };
  }

  const now = Date.now();
  let totalPenalty = 0;
  let matchCount = 0;

  persistentHistory.forEach((entry) => {
    const entryId = normalizeString(toSafeObject(entry).meal_id);
    if (entryId === foodId) {
      matchCount++;
      const ageMs = now - new Date(toSafeObject(entry).timestamp || now).getTime();
      const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));

      let decayFactor = 0.1;
      if (ageHours <= 24) decayFactor = 1.0;
      else if (ageHours <= 48) decayFactor = 0.7;
      else if (ageHours <= 72) decayFactor = 0.4;
      else decayFactor = 0.1;

      totalPenalty += (DIVERSITY_CONFIG.WEIGHTS.EXACT_MATCH || 0.3) * decayFactor;
    }
  });

  return {
    penalty: Number(totalPenalty.toFixed(6)),
    matchCount,
  };
}

function computeDiversityPenalty(food, userHistory) {
  const safeHistory = toSafeObject(userHistory);
  const mergedHistory = collectMultiDayHistory(safeHistory);
  const recentFoods = mergedHistory.foods;
  const categoryCount = mergedHistory.categories;
  const mealsByDay = mergedHistory.mealsByDay;
  const persistentHistory = toSafeArray(safeHistory.persistentHistory);

  const threshold = toSafeNumber(safeHistory.categoryThreshold, DIVERSITY_CONFIG.DEFAULT_CATEGORY_THRESHOLD);
  const recencyWindow = toSafeNumber(safeHistory.recencyWindow, DIVERSITY_CONFIG.DEFAULT_RECENCY_WINDOW);
  
  const foodId = normalizeString(food && food.recipe_id ? food.recipe_id : (food && (food.name || food.id)));
  const foodName = normalizeString(food && (food.name || food.recipe_id || food.id));
  const foodCategory = normalizeString(food && food.category);

  let penalty = 0;
  let historicalMatches = 0;

  if (foodName && recentFoods.includes(foodName)) {
    penalty += DIVERSITY_CONFIG.WEIGHTS.EXACT_MATCH;
  }

  // Persistent History Penalty
  const hist = computeHistoricalPenalty(foodId, persistentHistory);
  penalty += hist.penalty;
  historicalMatches = hist.matchCount;

  penalty += computeRecencyPenalty(foodName, recentFoods, recencyWindow);
  penalty += computeMultiDayPenalty(foodName, mealsByDay);

  if (foodCategory && toSafeNumber(categoryCount[foodCategory], 0) > threshold) {
    penalty += DIVERSITY_CONFIG.WEIGHTS.CATEGORY_REPETITION;
  }

  penalty += computeRotationPenalty(foodCategory, safeHistory);

  return {
    penalty: Number(Math.max(0, penalty).toFixed(6)),
    historicalMatches,
  };
}

function compareDiverseFoods(leftFood, rightFood) {
  if (rightFood.finalScore !== leftFood.finalScore) {
    return rightFood.finalScore - leftFood.finalScore;
  }

  if (leftFood.diversityPenalty !== rightFood.diversityPenalty) {
    return leftFood.diversityPenalty - rightFood.diversityPenalty;
  }

  const leftName = typeof leftFood.name === "string" ? leftFood.name : "";
  const rightName = typeof rightFood.name === "string" ? rightFood.name : "";
  return leftName.localeCompare(rightName);
}

function buildStageStats(candidates) {
  return {
    inputCount: Object.keys(candidates).reduce((sum, category) => sum + toSafeArray(candidates[category]).length, 0),
    outputCount: 0,
    historical_matches_count: 0,
    diversity_penalty_applied: 0,
    reason: "diversity_penalty",
  };
}

function decorateCandidate(food, userHistory, statsCollector) {
  const diversityResult = computeDiversityPenalty(food, userHistory);
  const score = Number(toSafeNumber(food && food.score, 0).toFixed(3));
  
  // Issue 5: Cap penalty at 50% of score
  const rawPenalty = diversityResult.penalty;
  const maxAllowedPenalty = Number((score * 0.5).toFixed(3));
  const diversityPenalty = Number(Math.min(rawPenalty, maxAllowedPenalty).toFixed(3));
  
  const finalScore = Number((score - diversityPenalty).toFixed(3));

  if (statsCollector) {
    statsCollector.historical_matches_count += diversityResult.historicalMatches;
    statsCollector.diversity_penalty_applied += diversityPenalty;
  }

  return {
    ...food,
    digestibility_score: toSafeNumber(food && food.digestibility_score, 0),
    evaluation: food && food.evaluation ? {
      ...food.evaluation,
      triggeredRules: toSafeArray(food.evaluation.triggeredRules).map((rule) => ({ ...rule })),
    } : {
      isValid: true,
      totalPenalty: 0,
      triggeredRules: [],
    },
    breakdown: food && food.breakdown ? { ...food.breakdown } : {},
    diversityPenalty,
    finalScore,
  };
}

function applyDiversity(candidates, userHistory) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const stageStats = buildStageStats(safeCandidates);

  const result = Object.keys(safeCandidates).reduce((acc, category) => {
    const categoryFoods = toSafeArray(safeCandidates[category]);

    acc[category] = categoryFoods
      .map((food) => decorateCandidate(food, userHistory, stageStats))
      .sort(compareDiverseFoods);

    stageStats.outputCount += acc[category].length;
    return acc;
  }, {});

  stageStats.diversity_penalty_applied = Number(stageStats.diversity_penalty_applied.toFixed(6));

  Object.defineProperty(result, "__stageStats", {
    value: stageStats,
    enumerable: false,
    writable: false,
  });

  return result;
}

module.exports = {
  applyDiversity,
  collectMultiDayHistory,
  computeDiversityPenalty,
};
