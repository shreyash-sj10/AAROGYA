const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildInfeasibleInput() {
  return {
    request_id: "fail_loud_request",
    trace_id: "fail_loud_trace",
    mealType: "lunch",
    foods: [],
    rules: sampleRules,
    userHistory: {},
    userState: {
      user_id: "fail_loud_user",
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
  };
}

(async function runFailLoudNoPlanTest() {
  const output = await executeGeneratePlanCore(buildInfeasibleInput());
  assert(output && typeof output === "object", "expected orchestrator output");
  assert(Array.isArray(output.meal_plan), "expected meal_plan array");
  assert(output.trace && output.trace.version === "Trace_v1", "expected Trace_v1 on empty pool path");
  const rel = output.trace && output.trace.stages && output.trace.stages.reliability_engine;
  assert(rel && typeof rel === "object", "expected reliability_engine stage in trace");

  console.log("PASS: empty candidate pool handled without crash (reliability / contract-safe path)");
})().catch((error) => {
  console.error("FAIL: fail-loud test failed");
  console.error(error.message);
  process.exit(1);
});
