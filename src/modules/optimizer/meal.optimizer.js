// Deprecated wrapper — use optimizer.js
const { optimizeMeal: optimizeCanonicalMeal } = require("./optimizer");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function createLegacyTemplate(scoredCandidates) {
  return {
    id: "legacy_optimizer_wrapper",
    meal_type: "lunch",
    name: "legacy_optimizer_wrapper",
    components: Object.keys(scoredCandidates && typeof scoredCandidates === "object" ? scoredCandidates : {}).map((category) => ({
      type: "flexible",
      category,
      quantity: 1,
    })),
    tags: ["legacy"],
    priority: 0,
  };
}

function normalizeLegacyFood(food) {
  const safeFood = food && typeof food === "object" ? food : {};
  const legacyEvaluation = safeFood.evaluation && typeof safeFood.evaluation === "object" ? safeFood.evaluation : {};

  return {
    ...safeFood,
    evaluation: {
      isValid: legacyEvaluation.isValid !== false && legacyEvaluation.is_valid !== false,
      totalPenalty: typeof legacyEvaluation.totalPenalty === "number"
        ? legacyEvaluation.totalPenalty
        : (typeof legacyEvaluation.total_penalty === "number" ? legacyEvaluation.total_penalty : 0),
      triggeredRules: Array.isArray(legacyEvaluation.triggeredRules)
        ? legacyEvaluation.triggeredRules.map((rule) => ({ ...rule }))
        : (Array.isArray(legacyEvaluation.triggered_rules) ? legacyEvaluation.triggered_rules.map((rule) => ({ ...rule })) : []),
    },
    finalScore: typeof safeFood.finalScore === "number"
      ? safeFood.finalScore
      : (typeof safeFood.score === "number" ? safeFood.score : 0),
  };
}

function calculateConfidence(userState, selectedItems) {
  const penalizedItemsCount = selectedItems.filter(
    (item) => item && item.evaluation && typeof item.evaluation.totalPenalty === "number" && item.evaluation.totalPenalty > 0
  ).length;
  const relaxedRulesCount = toSafeCount(userState && userState.relaxed_rules_count);
  let confidence = 1.0;

  confidence -= 0.15 * relaxedRulesCount;
  confidence -= 0.05 * penalizedItemsCount;
  confidence = Math.max(0.3, confidence);
  confidence = Number(confidence.toFixed(3));

  return {
    confidence,
    penalizedItemsCount,
    relaxedRulesCount,
  };
}

function optimizeMeal(userState, scoredCandidates) {
  const safeCandidates = scoredCandidates && typeof scoredCandidates === "object" ? scoredCandidates : {};
  const template = createLegacyTemplate(safeCandidates);
  const canonicalCandidates = Object.keys(safeCandidates).reduce((result, category) => {
    result[category] = toSafeArray(safeCandidates[category]).map(normalizeLegacyFood);
    return result;
  }, {});
  const optimized = optimizeCanonicalMeal(template, canonicalCandidates);
  const selectedItems = toSafeArray(optimized && optimized.breakdown && optimized.breakdown.items);
  const meal = selectedItems.reduce((result, item) => {
    if (item && typeof item.category === "string") {
      result[item.category] = { ...item };
    }
    return result;
  }, {});
  const selectedScores = selectedItems
    .filter((item) => item && typeof item.score === "number" && Number.isFinite(item.score))
    .map((item) => item.score);
  const averageScore = selectedScores.length > 0
    ? selectedScores.reduce((total, score) => total + score, 0) / selectedScores.length
    : 0;
  const confidenceResult = calculateConfidence(userState, selectedItems);

  return {
    meal,
    score: Number(averageScore.toFixed(3)),
    confidence: confidenceResult.confidence,
    meta: {
      category_count: selectedItems.length,
      has_penalty: confidenceResult.penalizedItemsCount > 0,
      penalized_items_count: confidenceResult.penalizedItemsCount,
      relaxed_rules_count: confidenceResult.relaxedRulesCount,
    },
  };
}

module.exports = {
  optimizeMeal,
};
