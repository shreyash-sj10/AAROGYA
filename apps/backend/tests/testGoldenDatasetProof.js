const crypto = require("crypto");
const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function canonicalizeOutput(output) {
  const safe = output && typeof output === "object" ? JSON.parse(JSON.stringify(output)) : {};
  if (safe.meta && typeof safe.meta === "object") {
    safe.meta.latency_ms = 0;
  }
  return safe;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const goldenCases = [
  {
    id: "pcos_case",
    userState: {
      user_id: "golden_pcos",
      goals: ["GOAL_WEIGHT_LOSS"],
      risk_flags: ["high_kapha"],
      symptoms: ["heaviness"],
      dosha_estimate: { vata: 0.2, pitta: 0.2, kapha: 0.6 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
  },
  {
    id: "diabetes_case",
    userState: {
      user_id: "golden_diabetes",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: ["high_pitta"],
      symptoms: ["acidity"],
      dosha_estimate: { vata: 0.3, pitta: 0.5, kapha: 0.2 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
  },
  {
    id: "gi_case",
    userState: {
      user_id: "golden_gi",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: ["high_vata"],
      symptoms: ["bloating"],
      dosha_estimate: { vata: 0.55, pitta: 0.25, kapha: 0.2 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "monsoon" },
    },
  },
  {
    id: "conflict_heavy_case",
    userState: {
      user_id: "golden_conflict",
      goals: ["GOAL_WEIGHT_LOSS"],
      risk_flags: ["high_vata", "high_pitta", "high_kapha"],
      symptoms: ["acidity", "bloating", "heaviness"],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: ["milk"],
      preferences: [],
      context: { meal_type: "lunch", season: "winter" },
    },
  },
];

(function runGoldenDataset() {
  goldenCases.forEach((testCase) => {
    const input = {
      request_id: `${testCase.id}_request`,
      trace_id: `${testCase.id}_trace`,
      mealType: "lunch",
      foods: sampleFoods,
      rules: sampleRules,
      userHistory: {},
      userState: testCase.userState,
      meta: {
        timestamp: 1711929600,
        request_source: "golden_dataset",
        cache_allowed: false,
      },
    };

    const first = executeGeneratePlanCore(input);
    const second = executeGeneratePlanCore(input);

    assert(first.meal_plan.length > 0, `${testCase.id}: expected non-empty meal plan`);
    assert(hash(canonicalizeOutput(first)) === hash(canonicalizeOutput(second)), `${testCase.id}: output not stable`);
    assert(hash(first.trace) === hash(second.trace), `${testCase.id}: trace not stable`);
  });

  console.log("PASS: golden dataset proof passed for PCOS/diabetes/GI/conflict cases");
})();

