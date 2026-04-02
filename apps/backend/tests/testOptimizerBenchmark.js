const { benchmarkAcrossBeamWidths, buildScaledFoods } = require("../src/utils/benchmark/optimizerBenchmark");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runScenario(label, config, expected) {
  const results = benchmarkAcrossBeamWidths(config);
  assert(results.length >= 2, `${label}: expected at least two benchmark comparisons`);

  results.forEach((result) => {
    assert(Number.isInteger(result.candidates) && result.candidates >= 0, `${label}: invalid candidate count`);
    assert(result.greedy_time_ms >= 0, `${label}: invalid greedy_time_ms`);
    assert(result.beam_time_ms >= 0, `${label}: invalid beam_time_ms`);
    assert(result.candidates >= expected.min, `${label}: candidates below expected range`);
    assert(result.candidates <= expected.max, `${label}: candidates above expected range`);

    const diff = result.result_difference;
    assert(typeof diff.same_selection === "boolean", `${label}: same_selection missing`);
    assert(typeof diff.score_delta === "number", `${label}: score_delta missing`);
    assert(typeof diff.greedy_selection === "string", `${label}: greedy_selection missing`);
    assert(typeof diff.beam_selection === "string", `${label}: beam_selection missing`);

    console.log(
      `[optimizer-benchmark] ${label} beam=${diff.beam_width} candidates=${result.candidates} greedy_ms=${result.greedy_time_ms} beam_ms=${result.beam_time_ms} score_delta=${diff.score_delta}`
    );
  });
}

(function runOptimizerBenchmarkTest() {
  const baseUserState = {
    user_id: "benchmark_test_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: [],
    dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: [],
    context: { meal_type: "lunch", season: "summer" },
  };

  runScenario("small", {
    foods: buildScaledFoods(1),
    rules: sampleRules,
    userState: baseUserState,
    mealType: "lunch",
    candidateTopK: 4,
    constraintTopK: 4,
    beamWidths: [3, 5],
  }, { min: 1, max: 10 });

  runScenario("medium", {
    foods: buildScaledFoods(4),
    rules: sampleRules,
    userState: baseUserState,
    mealType: "lunch",
    candidateTopK: 25,
    constraintTopK: 25,
    beamWidths: [3, 5],
  }, { min: 40, max: 60 });

  runScenario("large", {
    foods: buildScaledFoods(10),
    rules: sampleRules,
    userState: baseUserState,
    mealType: "lunch",
    candidateTopK: 70,
    constraintTopK: 70,
    beamWidths: [3, 5],
  }, { min: 101, max: 140 });

  console.log("PASS: optimizer benchmark covers small, medium, and large candidate sets with greedy versus beam comparisons");
})();

