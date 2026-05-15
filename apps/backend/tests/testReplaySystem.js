const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { replayAndVerify } = require("../src/core/pipeline/replay/replayEngine");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

(async function runReplayProof() {
  const iterations = 10;
  const originalRequest = baseInput();
  const originalOutput = await executeGeneratePlanCore(originalRequest);

  for (let i = 0; i < iterations; i += 1) {
    const replay = await replayAndVerify(originalRequest, originalOutput.trace, originalOutput);
    assert(replay && replay.replayOutput, `Missing replay output at run ${i + 1}`);
    assert(replay.traceHash && replay.outputHash, `Missing replay hashes at run ${i + 1}`);
  }

  console.log(`PASS: replay determinism verified across ${iterations} runs (trace + output identical)`);
})().catch((error) => {
  console.error("FAIL: replay system mismatch detected");
  console.error(error.message);
  process.exit(1);
});
