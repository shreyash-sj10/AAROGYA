const { getBestTemplate } = require("../../src/templates/mealTemplate.service");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const { generateCandidates } = require("../../src/modules/candidate/candidateGenerator");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const template = getBestTemplate("lunch");
const userState = {
  user_id: "module_candidate",
  diet_type: "vegetarian",
  allergies: [],
  risk_flags: [],
  conditions: [],
  context: { meal_type: "lunch", season: "summer" },
};

const runA = generateCandidates(template, sampleFoods, userState, []);
const runB = generateCandidates(template, sampleFoods, userState, []);

assert(JSON.stringify(runA) === JSON.stringify(runB), "candidate module must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "candidate __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "candidate __stageStats.outputCount missing");
assert(Number.isInteger(runA.__stageStats.rejectedCount), "candidate __stageStats.rejectedCount missing");

console.log("PASS: candidate module contract + determinism");
