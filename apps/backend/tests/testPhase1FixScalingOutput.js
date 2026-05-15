const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { loadAllFoods } = require("../src/modules/food");
const defaultRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function quantitySignature(mealPlan) {
  return (mealPlan || []).map((m) => Number((m.quantity || {}).value || 0));
}

(async () => {
  const foods = loadAllFoods();
  const base = {
    request_id: "phase1_fix_scaling_req",
    trace_id: "phase1_fix_scaling_trace",
    mealType: "lunch",
    foods,
    rules: defaultRules,
    userHistory: { recentFoods: [], categoryCount: {} },
    context: { history: [] },
    userState: {
      user_id: "phase1_fix_scaling_user",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    meta: { timestamp: 0, request_source: "test", cache_allowed: false },
  };

  const low = await executeGeneratePlanCore({
    ...base,
    constraints: { max_calories: 300, diet_type: "vegetarian" },
  });

  const high = await executeGeneratePlanCore({
    ...base,
    constraints: { max_calories: 1200, diet_type: "vegetarian" },
  });

  const lowSig = quantitySignature(low.meal_plan);
  const highSig = quantitySignature(high.meal_plan);
  const lowTotal = lowSig.reduce((a, b) => a + b, 0);
  const highTotal = highSig.reduce((a, b) => a + b, 0);

  assert(JSON.stringify(lowSig) !== JSON.stringify(highSig), `Expected different quantities, got low=${JSON.stringify(lowSig)} high=${JSON.stringify(highSig)}`);
  assert(highTotal > lowTotal, `Expected high calorie quantities > low calorie quantities, got lowTotal=${lowTotal} highTotal=${highTotal}`);
  console.log("PASS: scaling propagates to final meal_plan quantities (low vs high calorie targets)");
})();
