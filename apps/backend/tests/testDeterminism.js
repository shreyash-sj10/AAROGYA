const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeForComparison(response) {
  const safe = response && typeof response === "object" ? clone(response) : {};

  if (safe.meta && typeof safe.meta === "object") {
    delete safe.meta.latency_ms;
  }

  return safe;
}

function buildInput() {
  return {
    request_id: "determinism_request",
    trace_id: "determinism_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {
      recentFoods: ["mung dal", "brown rice"],
      categoryCount: { dal: 2, grain: 1 },
    },
    userState: {
      user_id: "determinism_user",
      goals: ["GOAL_WEIGHT_LOSS"],
      risk_flags: ["high_gi_sensitive"],
      symptoms: ["bloating"],
      dosha_estimate: {
        vata: 0.34,
        pitta: 0.33,
        kapha: 0.33,
      },
      allergies: ["peanut"],
      preferences: ["warm_food"],
      context: {
        meal_type: "lunch",
        season: "summer",
      },
      diet_type: "vegetarian",
    },
    aiProfile: {
      version: "AIProfileOutput_v1",
      schema_version: 1,
      compatibility: "backward",
      risk_flags: ["high_gi_sensitive"],
      dosha_estimate: {
        vata: 0.34,
        pitta: 0.33,
        kapha: 0.33,
      },
      confidence: 1,
    },
    meta: {
      timestamp: 1711929600,
      request_source: "determinism_test",
      cache_allowed: true,
      rules_version: "rules_v1",
      stateful_day_tracking: false,
    },
  };
}

(function runDeterminismProof() {
  const iterations = 100;
  const baselineInput = buildInput();
  const baseline = normalizeForComparison(executeGeneratePlanCore(clone(baselineInput)));

  for (let run = 1; run <= iterations; run += 1) {
    const current = normalizeForComparison(executeGeneratePlanCore(clone(baselineInput)));
    const equal = JSON.stringify(current) === JSON.stringify(baseline);
    assert(equal, `Determinism failed at run ${run}`);
  }

  console.log(`PASS: deterministic output remained identical across ${iterations} runs`);
})();

