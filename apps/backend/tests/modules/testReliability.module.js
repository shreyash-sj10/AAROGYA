const { applyReliability } = require("../../src/modules/reliability/reliabilityEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const passInput = {
  mealResult: {
    score: 0.7,
    breakdown: {
      items: [
        {
          id: "r1",
          recipe_id: "r1",
          name: "Rice",
          nutrition: { calories: 100, protein: 2, carbs: 20, fat: 1 },
          evaluation: { totalPenalty: 0, triggeredRules: [] },
          breakdown: { penalty: 0 },
        },
      ],
    },
  },
  optimizerStats: { outputCount: 1 },
  diversifiedCandidates: {},
  scoredCandidates: {},
  constrainedCandidates: {},
  candidates: {},
};

const fallbackInput = {
  mealResult: { score: 0, breakdown: { items: [] } },
  optimizerStats: { outputCount: 0 },
  diversifiedCandidates: {
    a: [
      { id: "x1", recipe_id: "x1", name: "X", finalScore: 0.6, evaluation: { totalPenalty: 0.1, triggeredRules: [] }, breakdown: { penalty: 0.1 }, nutrition: { calories: 50, protein: 1, carbs: 10, fat: 1 } },
      { id: "x2", recipe_id: "x2", name: "Y", finalScore: 0.6, evaluation: { totalPenalty: 0.2, triggeredRules: [] }, breakdown: { penalty: 0.2 }, nutrition: { calories: 55, protein: 1, carbs: 11, fat: 1 } },
    ],
  },
  scoredCandidates: {},
  constrainedCandidates: {},
  candidates: {},
};

const runA = applyReliability(passInput);
const runB = applyReliability(passInput);
assert(JSON.stringify(runA) === JSON.stringify(runB), "reliability pass path must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "reliability __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "reliability __stageStats.outputCount missing");

const fallback = applyReliability(fallbackInput);
assert(Array.isArray(fallback.mealPlan) && fallback.mealPlan.length === 1, "reliability fallback must return one meal");
assert(fallback.meta && fallback.meta.fallback_used === true, "reliability fallback meta missing");

console.log("PASS: reliability module contract + determinism");