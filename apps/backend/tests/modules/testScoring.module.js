const { getBestTemplate } = require("../../src/templates/mealTemplate.service");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");
const { generateCandidates } = require("../../src/modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../src/modules/constraint/constraintEngine");
const { scoreCandidates } = require("../../src/modules/scoring/scoringEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const template = getBestTemplate("lunch");
const userState = {
  user_id: "module_scoring",
  diet_type: "vegetarian",
  allergies: [],
  risk_flags: ["high_pitta"],
  conditions: ["diabetes"],
  context: { meal_type: "lunch", season: "summer" },
};

const candidates = generateCandidates(template, sampleFoods, userState, sampleRules);
const constrained = applyConstraints(template, candidates, userState, sampleRules);

const runA = scoreCandidates(constrained, userState, template);
const runB = scoreCandidates(constrained, userState, template);

assert(JSON.stringify(runA) === JSON.stringify(runB), "scoring module must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "scoring __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "scoring __stageStats.outputCount missing");

console.log("PASS: scoring module contract + determinism");
