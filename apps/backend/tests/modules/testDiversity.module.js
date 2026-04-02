const { getBestTemplate } = require("../../src/templates/mealTemplate.service");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");
const { generateCandidates } = require("../../src/modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../src/modules/constraint/constraintEngine");
const { scoreCandidates } = require("../../src/modules/scoring/scoringEngine");
const { applyDiversity } = require("../../src/modules/diversity/diversityEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const template = getBestTemplate("lunch");
const userState = {
  user_id: "module_diversity",
  diet_type: "vegetarian",
  allergies: [],
  risk_flags: [],
  conditions: [],
  context: { meal_type: "lunch", season: "summer" },
};
const history = { recentFoods: ["mung dal"], categoryCount: { dal: 2 } };

const candidates = generateCandidates(template, sampleFoods, userState, sampleRules);
const constrained = applyConstraints(template, candidates, userState, sampleRules);
const scored = scoreCandidates(constrained, userState, template);

const runA = applyDiversity(scored, history);
const runB = applyDiversity(scored, history);

assert(JSON.stringify(runA) === JSON.stringify(runB), "diversity module must be deterministic");
assert(runA.__stageStats && Number.isInteger(runA.__stageStats.inputCount), "diversity __stageStats.inputCount missing");
assert(Number.isInteger(runA.__stageStats.outputCount), "diversity __stageStats.outputCount missing");

console.log("PASS: diversity module contract + determinism");
