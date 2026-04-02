const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { replayAndVerify } = require("../src/core/pipeline/replay/replayEngine");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function baseInput() {
  return {
    request_id: "replay_request",
    trace_id: "replay_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {
      recentFoods: ["mung dal"],
      categoryCount: { dal: 1 },
    },
    userState: {
      user_id: "replay_user",
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
      request_source: "proof_test",
      cache_allowed: false,
    },
  };
}

(function runReplayProof() {
  const originalRequest = baseInput();
  const originalOutput = executeGeneratePlanCore(originalRequest);

  replayAndVerify(originalRequest, originalOutput.trace, originalOutput);

  console.log("PASS: replay system reproduces output and trace exactly");
})();

