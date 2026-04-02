const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assertThrows(fn, message) {
  let threw = false;

  try {
    fn();
  } catch (error) {
    threw = true;
  }

  if (!threw) {
    throw new Error(message);
  }
}

const input = {
  request_id: "ai_boundary_request",
  trace_id: "ai_boundary_trace",
  mealType: "lunch",
  foods: sampleFoods,
  rules: sampleRules,
  userHistory: {},
  userState: {
    user_id: "test_user",
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
  },
  aiProfile: {
    confidence: 0.99,
    meal: ["malicious_meal"],
    recipe_id: "malicious_recipe",
    ranking: ["x", "y"],
  },
  meta: {
    timestamp: 1711929600,
    request_source: "test",
    cache_allowed: false,
  },
};

assertThrows(() => executeGeneratePlanCore(input), "AI boundary violation did not throw");
console.log("PASS: AI boundary rejects decision leakage fields");

