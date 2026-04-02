const { _runPipelineInternal } = require("../../src/core/pipeline/pipeline");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const input = {
  mealType: "lunch",
  foods: sampleFoods,
  rules: sampleRules,
  userHistory: { recentFoods: ["mung dal"], categoryCount: { dal: 1 } },
  userState: {
    user_id: "module_pipeline",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: [],
    dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: [],
    context: { meal_type: "lunch", season: "summer" },
  },
};

const runA = _runPipelineInternal(input);
const runB = _runPipelineInternal(input);

assert(JSON.stringify(runA.stageStats) === JSON.stringify(runB.stageStats), "pipeline stage stats must be deterministic");
assert(runA.stageStats && runA.stageStats.candidate_generator, "pipeline missing candidate stage");
assert(runA.stageStats.constraint_engine, "pipeline missing constraint stage");
assert(runA.stageStats.scoring_engine, "pipeline missing scoring stage");
assert(runA.stageStats.diversity_engine, "pipeline missing diversity stage");
assert(runA.stageStats.optimizer, "pipeline missing optimizer stage");
assert(runA.stageStats.reliability_engine, "pipeline missing reliability stage");

console.log("PASS: pipeline orchestrates modular stages deterministically");
