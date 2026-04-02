const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function baseInput() {
  return {
    request_id: "trace_fidelity_request",
    trace_id: "trace_fidelity_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {
      recentFoods: ["mung dal"],
      categoryCount: { dal: 1 },
    },
    userState: {
      user_id: "trace_fidelity_user",
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

(function runTraceFidelityProof() {
  const output = executeGeneratePlanCore(baseInput());
  const stages = output.trace.stages;

  const required = [
    "candidate_generator",
    "constraint_engine",
    "scoring_engine",
    "diversity_engine",
    "optimizer",
    "reliability_engine",
  ];

  required.forEach((name) => {
    assert(stages[name], `missing stage ${name}`);
    assert(Number.isInteger(stages[name].input_count) && stages[name].input_count >= 0, `${name}.input_count invalid`);
    assert(Number.isInteger(stages[name].output_count) && stages[name].output_count >= 0, `${name}.output_count invalid`);
  });

  assert(stages.candidate_generator.output_count === stages.constraint_engine.input_count, "candidate->constraint mismatch");
  assert(stages.constraint_engine.output_count === stages.scoring_engine.input_count, "constraint->scoring mismatch");
  assert(stages.scoring_engine.output_count === stages.diversity_engine.input_count, "scoring->diversity mismatch");
  assert(stages.diversity_engine.output_count === stages.optimizer.input_count, "diversity->optimizer mismatch");
  assert(stages.optimizer.output_count === stages.reliability_engine.input_count, "optimizer->reliability mismatch");

  console.log("PASS: trace fidelity proof validated");
})();

