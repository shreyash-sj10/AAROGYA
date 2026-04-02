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
    request_id: "trace_integrity_request",
    trace_id: "trace_integrity_trace",
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
      request_source: "trace_test",
      cache_allowed: false,
    },
  };
}

function stage(name, stages) {
  const value = stages[name];
  assert(value && typeof value === "object", `Missing stage ${name}`);
  return value;
}

function assertNonNegativeCounts(stages) {
  const keys = [
    "candidate_generator",
    "constraint_engine",
    "scoring_engine",
    "diversity_engine",
    "optimizer",
    "reliability_engine",
  ];

  keys.forEach((key) => {
    const s = stage(key, stages);
    assert(Number.isInteger(s.input_count) && s.input_count >= 0, `${key}.input_count must be non-negative integer`);
    assert(Number.isInteger(s.output_count) && s.output_count >= 0, `${key}.output_count must be non-negative integer`);
  });

  const constraint = stage("constraint_engine", stages);
  const optimizer = stage("optimizer", stages);
  assert(Number.isInteger(constraint.rejected) && constraint.rejected >= 0, "constraint_engine.rejected must be non-negative integer");
  assert(Number.isInteger(optimizer.combinations_evaluated) && optimizer.combinations_evaluated >= 0, "optimizer.combinations_evaluated must be non-negative integer");
}

function assertTransitions(stages) {
  const candidate = stage("candidate_generator", stages);
  const constraint = stage("constraint_engine", stages);
  const scoring = stage("scoring_engine", stages);
  const diversity = stage("diversity_engine", stages);
  const optimizer = stage("optimizer", stages);
  const reliability = stage("reliability_engine", stages);

  assert(candidate.output_count === constraint.input_count, "candidate->constraint transition mismatch");
  assert(constraint.output_count === scoring.input_count, "constraint->scoring transition mismatch");
  assert(scoring.output_count === diversity.input_count, "scoring->diversity transition mismatch");
  assert(diversity.output_count === optimizer.input_count, "diversity->optimizer transition mismatch");
  assert(optimizer.output_count === reliability.input_count, "optimizer->reliability transition mismatch");
}

function assertFilterStageConstraint(stages) {
  const candidate = stage("candidate_generator", stages);
  const constraint = stage("constraint_engine", stages);
  assert(candidate.output_count <= candidate.input_count, "candidate stage cannot increase count");
  assert(constraint.output_count <= constraint.input_count, "constraint stage cannot increase count");
}

(function runTraceIntegrityTest() {
  const response = executeGeneratePlanCore(baseInput());
  const trace = response && response.trace ? response.trace : null;
  assert(trace, "Trace missing from response");

  const stages = trace.stages;
  assert(stages && typeof stages === "object", "Trace stages missing");

  assertNonNegativeCounts(stages);
  assertTransitions(stages);
  assertFilterStageConstraint(stages);

  console.log("PASS: trace integrity validated across all stages");
})();

