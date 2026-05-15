/**
 * Golden fixture: stable timestamp + inited repos → two runs → identical canonical hashes.
 */
const crypto = require("crypto");
const { executeGeneratePlanCore } = require("../../src/core/pipeline/orchestrator");
const { initializeFoodRepository } = require("../../src/repositories/food.repository");
const { initializeRuleRepository } = require("../../src/repositories/rule.repository");
const { initializeTemplateRepository } = require("../../src/repositories/template.repository");
const { sampleFoods } = require("../../src/modules/food/food.samples");
const sampleRules = require("../../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalPlanAndTrace(response) {
  const safe = JSON.parse(JSON.stringify(response && typeof response === "object" ? response : {}));
  if (safe.meta && typeof safe.meta === "object") {
    delete safe.meta.latency_ms;
    delete safe.meta.served_latency_ms;
  }
  return {
    meal_plan: safe.meal_plan,
    trace: safe.trace,
    score: safe.score,
  };
}

function buildGoldenInput() {
  return {
    request_id: "golden_fixture_det_req",
    trace_id: "golden_fixture_det_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: { recentFoods: [], categoryCount: {} },
    userState: {
      user_id: "golden_fixture_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
      diet: "vegetarian",
      diet_type: "vegetarian",
    },
    constraints: { max_calories: 650, diet_type: "vegetarian" },
    meta: {
      timestamp: 1711929600,
      request_source: "golden_fixture_determinism",
      cache_allowed: false,
    },
  };
}

(async function main() {
  await Promise.all([
    initializeFoodRepository(),
    initializeRuleRepository(),
    initializeTemplateRepository(),
  ]);

  const input = buildGoldenInput();
  const a = canonicalPlanAndTrace(await executeGeneratePlanCore(JSON.parse(JSON.stringify(input))));
  const b = canonicalPlanAndTrace(await executeGeneratePlanCore(JSON.parse(JSON.stringify(input))));

  assert(Array.isArray(a.meal_plan) && a.meal_plan.length > 0, "expected non-empty meal_plan");
  assert(a.trace && a.trace.version === "Trace_v1", "expected Trace_v1");

  const ha = hash(a);
  const hb = hash(b);
  assert(ha === hb, `golden determinism hash mismatch: ${ha} vs ${hb}`);

  console.log("PASS: golden fixture determinism (meal_plan + trace hash stable across two runs)");
})().catch((err) => {
  console.error("FAIL: golden fixture determinism");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
