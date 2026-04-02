const { CANDIDATE_CONFIG } = require("../../config/candidate");
const { toSafeArray } = require("../../utils/normalizeInput");
const { extractCategories } = require("../../templates/mealTemplate.service");
const { filterFoods } = require("../../rules/engine/constraintEngine");
const { compareCandidates } = require("../candidate/candidateGenerator");

function toSafeTopK(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return CANDIDATE_CONFIG.DEFAULT_TOP_K;
  }

  return Math.max(0, Math.floor(value));
}

function applyConstraints(template, candidates, userState, rules, options = {}) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const safeRules = toSafeArray(rules);
  const categories = Array.from(new Set(extractCategories(template)));
  const topK = toSafeTopK(options.topK);

  const stageStats = {
    inputCount: categories.reduce((sum, category) => sum + toSafeArray(safeCandidates[category]).length, 0),
    outputCount: 0,
    rejectedCount: 0,
    reason: "constraint_filtering",
  };

  const constrained = categories.reduce((acc, category) => {
    const categoryCandidates = toSafeArray(safeCandidates[category]);
    const filteredResult = filterFoods(categoryCandidates, userState, safeRules);
    const validFoods = toSafeArray(filteredResult.validFoods)
      .sort(compareCandidates)
      .slice(0, topK > 0 ? topK : undefined);

    acc[category] = validFoods;

    stageStats.outputCount += validFoods.length;
    stageStats.rejectedCount += Math.max(0, toSafeArray(filteredResult.rejectedFoods).length)
      + Math.max(0, toSafeArray(filteredResult.validFoods).length - validFoods.length);

    return acc;
  }, {});

  Object.defineProperty(constrained, "__stageStats", {
    value: stageStats,
    enumerable: false,
    writable: false,
  });

  return constrained;
}

module.exports = {
  applyConstraints,
};

