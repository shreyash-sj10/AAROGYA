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
    request_id: "trace_consistency_request",
    trace_id: "trace_consistency_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {
      recentFoods: ["mung dal"],
      categoryCount: { dal: 1 },
    },
    userState: {
      user_id: "trace_user",
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
      request_source: "trace_consistency_test",
      cache_allowed: false,
    },
  };
}

function stage(stages, name) {
  const value = stages[name];
  assert(value && typeof value === "object", `Missing stage: ${name}`);
  return value;
}

(function runTraceConsistencyTest() {
  const result = executeGeneratePlanCore(baseInput());
  const trace = result && result.trace;

  assert(trace && typeof trace === "object", "Missing trace object");
  const stages = trace.stages;
  assert(stages && typeof stages === "object", "Missing trace stages");

  const candidate = stage(stages, "candidate_generator");
  const constraint = stage(stages, "constraint_engine");
  const scoring = stage(stages, "scoring_engine");
  const diversity = stage(stages, "diversity_engine");
  const optimizer = stage(stages, "optimizer");
  const reliability = stage(stages, "reliability_engine");

  const allStages = [candidate, constraint, scoring, diversity, optimizer, reliability];
  allStages.forEach((s, index) => {
    assert(Number.isInteger(s.input_count) && s.input_count >= 0, `Stage ${index} input_count invalid`);
    assert(Number.isInteger(s.output_count) && s.output_count >= 0, `Stage ${index} output_count invalid`);
  });

  assert(Number.isInteger(constraint.rejected) && constraint.rejected >= 0, "constraint.rejected invalid");
  assert(Number.isInteger(optimizer.combinations_evaluated) && optimizer.combinations_evaluated >= 0, "optimizer.combinations_evaluated invalid");

  assert(candidate.output_count === constraint.input_count, "candidate->constraint transition mismatch");
  assert(constraint.output_count === scoring.input_count, "constraint->scoring transition mismatch");
  assert(scoring.output_count === diversity.input_count, "scoring->diversity transition mismatch");
  assert(diversity.output_count === optimizer.input_count, "diversity->optimizer transition mismatch");
  assert(optimizer.output_count === reliability.input_count, "optimizer->reliability transition mismatch");

  console.log("PASS: trace consistency validated across all stage transitions");
})();
