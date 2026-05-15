const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildInput(allergies) {
  return {
    request_id: "p0_safety_request",
    trace_id: "p0_safety_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {},
    userState: {
      user_id: "p0_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies,
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

(async function runP0Safety() {
  const cases = [
    ["mung dal"],
    ["toor dal"],
    ["rice"],
    ["milk"],
  ];

  for (let idx = 0; idx < cases.length; idx += 1) {
    const allergies = cases[idx];
    const output = await executeGeneratePlanCore(buildInput(allergies));
    const mealNames = output.meal_plan.map((item) => String(item.name || "").toLowerCase());
    for (let j = 0; j < allergies.length; j += 1) {
      const allergy = allergies[j];
      const blocked = String(allergy).toLowerCase();
      const leaked = mealNames.some((name) => name.includes(blocked));
      assert(!leaked, `P0 safety violation in case ${idx + 1}: found allergy ${blocked}`);
    }
  }

  console.log("PASS: P0 safety proof passed for allergy/prohibited cases");
})().catch((error) => {
  console.error("FAIL: P0 safety proof");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

