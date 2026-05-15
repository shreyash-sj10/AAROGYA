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
    priority: "P0",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "user.allergies", operator: "includes", value: "unsafe_dal" },
        { entity: "food.id", operator: "=", value: "unsafe-dal" },
      ],
    },
    action: { type: "reject", message_template: "Unsafe dal blocked by P0" },
  };
}

function buildInput() {
  const dalFoods = sampleFoods.filter((food) => String(food.category || "").toLowerCase() === "dal");
  const safeDal = { ...dalFoods[0], id: "safe-dal", name: "Safe Dal", functional: { ...dalFoods[0].functional, digestibility_score: 0.95 } };
  const unsafeDal = { ...dalFoods[1], id: "unsafe-dal", name: "Unsafe Dal", functional: { ...dalFoods[1].functional, digestibility_score: 0.1 } };

  return {
    request_id: "phase1_final_no_plan_req",
    trace_id: "phase1_final_no_plan_trace",
    mealType: "lunch",
    foods: [safeDal, unsafeDal],
    rules: [buildP0Rule()],
    userHistory: {},
    userState: {
      user_id: "phase1_final_no_plan_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: ["unsafe_dal"],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    meta: { timestamp: 1711929600, request_source: "phase1_final_no_plan", cache_allowed: false },
  };
}

(async () => {
  const output = await executeGeneratePlanCore(buildInput());
  const names = (output.meal_plan || []).map((item) => String(item.name || "").toLowerCase());

  assert((output.meal_plan || []).length > 0, "expected fallback/reliability to always return a plan");
  assert(!names.some((name) => name.includes("unsafe dal")), "fallback returned P0-unsafe meal");
  console.log("PASS: no-plan edge case returns safe fallback plan instead of throwing");
})();
