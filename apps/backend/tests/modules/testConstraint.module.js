const { getBestTemplate } = require("../../src/templates/mealTemplate.service");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");
const { generateCandidates } = require("../../src/modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../src/modules/constraint/constraintEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const template = getBestTemplate("lunch");
const userState = {
  user_id: "module_constraint",
  diet_type: "vegetarian",
  allergies: [],
  risk_flags: ["high_pitta"],
  conditions: ["diabetes"],
  context: { meal_type: "lunch", season: "summer" },
};

const candidates = generateCandidates(template, sampleFoods, userState, sampleRules);
const runA = applyConstraints(template, candidates, userState, sampleRules);
const runB = applyConstraints(template, candidates, userState, sampleRules);

assert(JSON.stringify(runA) === JSON.stringify(runB), "constraint module must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "constraint __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "constraint __stageStats.outputCount missing");
assert(Number.isInteger(runA.__stageStats.rejectedCount), "constraint __stageStats.rejectedCount missing");

console.log("PASS: constraint module contract + determinism");
