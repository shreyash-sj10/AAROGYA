const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function baseInput(overrides = {}) {
  return {
    request_id: "failure_proof_request",
    trace_id: "failure_proof_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {},
    userState: {
      user_id: "failure_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    meta: {
      timestamp: 1711929600,
      request_source: "proof_test",
      cache_allowed: false,
    },
    ...overrides,
  };
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
  }
  assert(threw, message);
}

(function runFailureProof() {
  const fallbackFoods = sampleFoods.filter((f) => String(f.category || "").toLowerCase() === "dal");
  const fallbackOut = executeGeneratePlanCore(baseInput({ foods: fallbackFoods }));
  assert(fallbackOut.trace.stages.optimizer.output_count === 0, "fallback case should have optimizer output_count = 0");
  assert(fallbackOut.meal_plan.length > 0, "fallback case should return meal plan");

  const emptyFoods = [];
  assertThrows(
    () => executeGeneratePlanCore(baseInput({ foods: emptyFoods })),
    "empty candidate case must fail loudly"
  );

  const forcedRelaxFoods = sampleFoods.filter((f) => String(f.category || "").toLowerCase() !== "dal");
  const forcedRelaxOut = executeGeneratePlanCore(baseInput({ foods: forcedRelaxFoods }));
  assert(forcedRelaxOut.trace.stages.optimizer.output_count === 0, "forced relaxation should hit optimizer empty path");
  assert(forcedRelaxOut.meal_plan.length > 0, "forced relaxation should remain predictable with fallback meal");

  console.log("PASS: failure-case proof passed for empty candidate, forced relaxation, fallback");
})();

