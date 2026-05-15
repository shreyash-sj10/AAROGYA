const { generateMealPlan } = require("../src/core/pipeline/orchestrator");
const { validateDecisionResponse } = require("../src/contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../src/contracts/validators/validateTrace");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const response = await generateMealPlan({
    request_id: "contract_request",
    trace_id: "contract_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {},
    userState: {
      user_id: "contract_user",
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
    meta: {
      timestamp: 1711929600,
      request_source: "test",
      cache_allowed: false,
    },
  });

  const responseValidation = validateDecisionResponse(response);
  const traceValidation = validateTrace(response.trace);

  assert(responseValidation.valid, `DecisionResponse_v1 invalid: ${JSON.stringify(responseValidation.errors || [])}`);
  assert(traceValidation.valid, `Trace_v1 invalid: ${JSON.stringify(traceValidation.errors || [])}`);

  console.log("PASS: response and trace are contract compliant");
})().catch((err) => {
  console.error("FAIL: response contracts");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

