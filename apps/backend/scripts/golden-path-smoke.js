/**
 * In-process golden path: DecisionRequest-shaped input -> executeGeneratePlanCore -> meal_plan + trace.
 * Does not start HTTP. Works with JSON fallbacks when DATABASE_URL is unset (same as unit tests).
 */
const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { initializeFoodRepository } = require("../src/repositories/food.repository");
const { initializeRuleRepository } = require("../src/repositories/rule.repository");
const { initializeTemplateRepository } = require("../src/repositories/template.repository");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

async function main() {
  await Promise.all([
    initializeFoodRepository(),
    initializeRuleRepository(),
    initializeTemplateRepository(),
  ]);
  const input = {
    request_id: "golden_path_smoke_req",
    trace_id: "golden_path_smoke_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: { recentFoods: [], categoryCount: {} },
    userState: {
      user_id: "golden_path_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: {
        meal_type: "lunch",
        season: "summer",
      },
      diet: "vegetarian",
      diet_type: "vegetarian",
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
    },
    meta: {
      timestamp: Math.floor(Date.now() / 1000),
      request_source: "golden_path_smoke",
      cache_allowed: false,
    },
  };

  const response = await executeGeneratePlanCore(input);
  const plan = response && response.meal_plan;
  const trace = response && response.trace;

  if (!Array.isArray(plan) || plan.length === 0) {
    console.error("FAIL: empty meal_plan");
    process.exit(1);
  }

  if (!trace || trace.version !== "Trace_v1") {
    console.error("FAIL: missing or invalid trace");
    process.exit(1);
  }

  console.log("OK golden-path-smoke:", plan.length, "meals,", "trace_id=", trace.trace_id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
