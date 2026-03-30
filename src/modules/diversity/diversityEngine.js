const { DIVERSITY_CONFIG } = require("../../config/diversity");
const { normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

function computeDiversityPenalty(food, userHistory) {
  const safeHistory = userHistory && typeof userHistory === "object" ? userHistory : {};
  const recentFoods = toSafeArray(safeHistory.recentFoods).map(normalizeString);
  const categoryCount = safeHistory.categoryCount && typeof safeHistory.categoryCount === "object"
    ? safeHistory.categoryCount
    : {};
  const threshold = toSafeNumber(safeHistory.categoryThreshold, DIVERSITY_CONFIG.DEFAULT_CATEGORY_THRESHOLD);
  const foodName = normalizeString(food && food.name);
  const foodCategory = normalizeString(food && food.category);

  // Penalties scaled to match scoring range (0–1)
  // Prevents excessive negative final scores
  if (foodName && recentFoods.includes(foodName)) {
    return DIVERSITY_CONFIG.WEIGHTS.EXACT_MATCH;
  }

  if (foodCategory && toSafeNumber(categoryCount[foodCategory], 0) > threshold) {
    return DIVERSITY_CONFIG.WEIGHTS.CATEGORY_REPETITION;
  }

  return 0;
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

function applyDiversity(candidates, userHistory) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};

  return Object.keys(safeCandidates).reduce((result, category) => {
    const categoryFoods = toSafeArray(safeCandidates[category]);

    result[category] = categoryFoods
      .map((food) => {
        const diversityPenalty = computeDiversityPenalty(food, userHistory);
        const score = toSafeNumber(food && food.score, 0);
        const finalScore = Number((score - diversityPenalty).toFixed(3));

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
      })
      .sort(compareDiverseFoods);

    return result;
  }, {});
}

module.exports = {
  applyDiversity,
  computeDiversityPenalty,
};
