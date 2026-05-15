const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildP0Rule() {
  return {
    id: "p0_allergy_unsafe_dal",
    name: "Never select unsafe dal for allergy profile",
    priority: "P0",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          entity: "user.allergies",
          operator: "includes",
          value: "unsafe_dal",
        },
        {
          entity: "food.id",
          operator: "=",
          value: "unsafe-dal",
        },
      ],
    },
    action: {
      type: "reject",
      message_template: "Unsafe dal blocked by P0 allergy rule",
    },
  };
}

function buildInput() {
  const dalFoods = sampleFoods.filter((food) => String(food.category || "").toLowerCase() === "dal");
  const safeDal = { ...dalFoods[0], id: "safe-dal", name: "Safe Dal", functional: { ...dalFoods[0].functional, digestibility_score: 0.95 } };
  const unsafeDal = { ...dalFoods[1], id: "unsafe-dal", name: "Unsafe Dal", functional: { ...dalFoods[1].functional, digestibility_score: 0.1 } };

  return {
    request_id: "fallback_p0_request",
    trace_id: "fallback_p0_trace",
    mealType: "lunch",
    foods: [safeDal, unsafeDal],
    rules: [buildP0Rule()],
    userHistory: {},
    userState: {
      user_id: "fallback_p0_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: ["unsafe_dal"],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    meta: {
      timestamp: 1711929600,
      request_source: "fallback_p0_test",
      cache_allowed: false,
    },
  };
}

(async function runFallbackP0Safety() {
  const output = await executeGeneratePlanCore(buildInput());
  const names = output.meal_plan.map((item) => String(item.name || "").toLowerCase());

  assert(output.trace.stages.optimizer.output_count === 0, "expected empty optimizer result to trigger fallback path");
  assert(!names.some((name) => name.includes("unsafe dal")), "fallback selected P0-blocked candidate");
  assert(output.meal_plan.length > 0, "fallback should still produce a safe meal");

  // ── P0 Trace guarantees ──────────────────────────────────────────────────────
  const constraintStage = output.trace.stages.constraint_engine;

  assert(
    typeof constraintStage.p0_rules_checked === "number",
    "trace.stages.constraint_engine.p0_rules_checked is a number"
  );
  assert(
    constraintStage.p0_rules_checked >= 1,
    "trace.stages.constraint_engine.p0_rules_checked >= 1 (P0 rule was active)"
  );
  assert(
    typeof constraintStage.p0_violations === "number",
    "trace.stages.constraint_engine.p0_violations is a number"
  );
  assert(
    constraintStage.p0_violations >= 0,
    "trace.stages.constraint_engine.p0_violations is non-negative"
  );
  assert(
    Array.isArray(constraintStage.p0_violated_rule_ids),
    "trace.stages.constraint_engine.p0_violated_rule_ids is an array"
  );

  console.log("PASS: fallback remains P0-safe when optimizer output is empty");
  console.log("PASS: trace.stages.constraint_engine includes all P0 metadata fields");
  console.log("  p0_rules_checked:", constraintStage.p0_rules_checked);
  console.log("  p0_violations:", constraintStage.p0_violations);
  console.log("  p0_violated_rule_ids:", JSON.stringify(constraintStage.p0_violated_rule_ids));
})();


