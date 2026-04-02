const { optimizeMeal } = require("../../src/modules/optimizer/optimizer");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const template = {
  id: "t1",
  meal_type: "lunch",
  name: "test_template",
  tags: ["test"],
  priority: 1,
  components: [
    { type: "flexible", category: "dal", quantity: 1 },
    { type: "flexible", category: "vegetable", quantity: 1 },
  ],
};

const candidates = {
  dal: [
    { id: "a1", recipe_id: "a1", name: "AppleDal", score: 0.8, finalScore: 0.8, evaluation: { totalPenalty: 0, triggeredRules: [] }, breakdown: { penalty: 0 }, diversityPenalty: 0 },
    { id: "a2", recipe_id: "a2", name: "AvocadoDal", score: 0.8, finalScore: 0.8, evaluation: { totalPenalty: 0, triggeredRules: [] }, breakdown: { penalty: 0 }, diversityPenalty: 0 },
  ],
  vegetable: [
    { id: "b1", recipe_id: "b1", name: "BananaVeg", score: 0.8, finalScore: 0.8, evaluation: { totalPenalty: 0, triggeredRules: [] }, breakdown: { penalty: 0 }, diversityPenalty: 0 },
    { id: "b2", recipe_id: "b2", name: "BerryVeg", score: 0.8, finalScore: 0.8, evaluation: { totalPenalty: 0, triggeredRules: [] }, breakdown: { penalty: 0 }, diversityPenalty: 0 },
  ],
};

const runA = optimizeMeal(template, candidates);
const runB = optimizeMeal(template, candidates);

assert(JSON.stringify(runA) === JSON.stringify(runB), "optimizer module must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "optimizer __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "optimizer __stageStats.outputCount missing");
assert(Number.isInteger(runA.__stageStats.combinationsEvaluated), "optimizer combinationsEvaluated missing");

console.log("PASS: optimizer module contract + determinism");