/**
 * Fuzz-style guard: orchestrator must reject aiProfile trees that embed forbidden decision keys.
 */
const { executeGeneratePlanCore } = require("../../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");
const { ContractViolationError } = require("../../src/contracts/errors/ContractViolationError");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function baseInput() {
  return {
    request_id: "p0_ai_leak_req",
    trace_id: "p0_ai_leak_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {},
    userState: {
      user_id: "p0_ai_user",
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
      request_source: "p0_ai_boundary",
      cache_allowed: false,
    },
  };
}

(async function main() {
  const malicious = {
    ...baseInput(),
    aiProfile: {
      version: "AIProfileOutput_v1",
      schema_version: 1,
      compatibility: "backward",
      risk_flags: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      confidence: 1,
      recipe_id: "model_must_not_emit_this",
    },
  };

  let threw = false;
  try {
    await executeGeneratePlanCore(malicious);
  } catch (err) {
    threw = true;
    assert(err instanceof ContractViolationError, "expected ContractViolationError for AI leak");
    assert(String(err.message || "").toLowerCase().includes("boundary"), "expected AI boundary violation message");
  }
  assert(threw, "expected orchestrator to reject malicious aiProfile");

  console.log("PASS: malicious aiProfile with forbidden decision fields is rejected");
})().catch((err) => {
  console.error("FAIL: malicious aiProfile boundary");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
