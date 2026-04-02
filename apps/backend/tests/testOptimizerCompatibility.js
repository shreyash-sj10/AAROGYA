const { optimizeMeal } = require("../src/modules/optimizer/optimizer");
const { optimizeMealLegacy } = require("../src/modules/optimizer/optimizer.legacy");
const { getBestTemplate } = require("../src/templates/mealTemplate.service");
const { generateCandidates } = require("../src/modules/candidate/candidateGenerator");
const { scoreCandidates } = require("../src/modules/scoring/scoringEngine");
const { sampleFoods } = require("../src/modules/food/food.samples");
const rules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return;
  }

  console.log("PASS:", message);
}

function getSampleInput() {
  const userState = {
    user_id: "u-optimizer-check",
    goal: "maintenance",
    diet: "veg",
    allergies: [],
    risk_flags: ["high_pitta"],
    conditions: ["diabetes"],
    context: { meal_type: "lunch", season: "summer" },
  };

  const template = getBestTemplate("lunch");
  const candidates = generateCandidates(template, sampleFoods, userState, rules);
  const scored = scoreCandidates(candidates, userState, template);

  return { template, scored };
}

function hasOptimizerShape(result) {
  return Boolean(
    result
    && typeof result === "object"
    && Array.isArray(result.meal)
    && typeof result.score === "number"
    && result.breakdown
    && typeof result.breakdown === "object"
    && Array.isArray(result.breakdown.items)
    && typeof result.breakdown.totalScore === "number"
    && result.breakdown.meta
    && typeof result.breakdown.meta === "object"
    && Array.isArray(result.breakdown.meta.fixedItems)
    && Array.isArray(result.breakdown.meta.flexibleCategories)
    && Array.isArray(result.breakdown.meta.categoriesUsed)
    && typeof result.breakdown.meta.totalPenalty === "number"
    && typeof result.breakdown.meta.totalDiversityPenalty === "number"
    && typeof result.breakdown.meta.combinationCount === "number"
  );
}

function haveSameTopLevelStructure(left, right) {
  if (!hasOptimizerShape(left) || !hasOptimizerShape(right)) {
    return false;
  }

  const leftKeys = Object.keys(left).sort().join("|");
  const rightKeys = Object.keys(right).sort().join("|");
  const leftBreakdownKeys = Object.keys(left.breakdown).sort().join("|");
  const rightBreakdownKeys = Object.keys(right.breakdown).sort().join("|");
  const leftMetaKeys = Object.keys(left.breakdown.meta).sort().join("|");
  const rightMetaKeys = Object.keys(right.breakdown.meta).sort().join("|");

  return leftKeys === rightKeys
    && leftBreakdownKeys === rightBreakdownKeys
    && leftMetaKeys === rightMetaKeys;
}

(function run() {
  const { template, scored } = getSampleInput();

  const first = optimizeMeal(template, scored);
  const second = optimizeMeal(template, scored);

  assert(JSON.stringify(first) === JSON.stringify(second), "Same input returns same output (determinism)");

  const legacy = optimizeMealLegacy(template, scored);
  const current = optimizeMeal(template, scored);

  assert(hasOptimizerShape(legacy), "Old optimizer output has expected shape");
  assert(hasOptimizerShape(current), "New optimizer output has expected shape");
  assert(haveSameTopLevelStructure(legacy, current), "Old and new output structures are identical");

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
})();

