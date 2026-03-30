// Deprecated wrapper — use scoringEngine.js
const { scoreCandidates: scoreCanonicalCandidates } = require("./scoringEngine");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createLegacyTemplate(candidates) {
  return {
    id: "legacy_scoring_wrapper",
    meal_type: "lunch",
    name: "legacy_scoring_wrapper",
    components: Object.keys(candidates && typeof candidates === "object" ? candidates : {}).map((category) => ({
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
  };
}

function toLegacyFood(food) {
  return {
    ...food,
    evaluation: {
      is_valid: food && food.evaluation ? food.evaluation.isValid !== false : true,
      total_penalty: food && food.evaluation && typeof food.evaluation.totalPenalty === "number" ? food.evaluation.totalPenalty : 0,
      triggered_rules: food && food.evaluation && Array.isArray(food.evaluation.triggeredRules)
        ? food.evaluation.triggeredRules.map((rule) => ({ ...rule }))
        : [],
    },
  };
}

function scoreCandidates(userState, candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const template = createLegacyTemplate(safeCandidates);
  const canonicalCandidates = Object.keys(safeCandidates).reduce((result, category) => {
    result[category] = toSafeArray(safeCandidates[category]).map(normalizeLegacyFood);
    return result;
  }, {});
  const scored = scoreCanonicalCandidates(canonicalCandidates, userState, template);

  return Object.keys(scored).reduce((result, category) => {
    result[category] = toSafeArray(scored[category]).map(toLegacyFood);
    return result;
  }, {});
}

module.exports = {
  scoreCandidates,
};
