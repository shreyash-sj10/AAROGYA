// Deprecated wrapper — use candidateGenerator.js
const { generateCandidates: generateCanonicalCandidates } = require("./candidateGenerator");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createLegacyTemplate(categories) {
  return {
    id: "legacy_candidate_wrapper",
    meal_type: "lunch",
    name: "legacy_candidate_wrapper",
    components: toSafeArray(categories).map((category) => ({
      type: "flexible",
      category,
      quantity: 1,
    })),
    tags: ["legacy"],
    priority: 0,
  };
}

function toLegacyEvaluation(evaluation) {
  const safeEvaluation = evaluation && typeof evaluation === "object" ? evaluation : {};

  return {
    is_valid: safeEvaluation.isValid !== false,
    total_penalty: typeof safeEvaluation.totalPenalty === "number" ? safeEvaluation.totalPenalty : 0,
    triggered_rules: Array.isArray(safeEvaluation.triggeredRules) ? safeEvaluation.triggeredRules.map((rule) => ({ ...rule })) : [],
  };
}

function toLegacyCandidate(food) {
  return {
    ...food,
    evaluation: toLegacyEvaluation(food && food.evaluation),
  };
}

function generateCandidates(userState, categories, foods, rules, options) {
  const template = createLegacyTemplate(categories);
  const candidates = generateCanonicalCandidates(template, foods, userState, rules, options);

  return Object.keys(candidates).reduce((result, category) => {
    result[category] = toSafeArray(candidates[category]).map(toLegacyCandidate);
    return result;
  }, {});
}

module.exports = {
  generateCandidates,
};
