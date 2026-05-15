/**
 * Phase 1.4 — minimal golden payloads validate against compiled schemas (no drift vs PRD _v2 policy).
 */
const { validateDecisionRequest } = require("../../src/contracts/validators/validateDecisionRequest");
const { validateDecisionResponse } = require("../../src/contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../../src/contracts/validators/validateTrace");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const minimalRequest = {
  version: "DecisionRequest_v1",
  schema_version: 1,
  compatibility: "backward",
  request_id: "schema_smoke_req",
  trace_id: "schema_smoke_trace",
  user_state: {
    user_id: "schema_smoke_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: [],
    dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: [],
    context: { meal_type: "lunch", season: "summer" },
  },
  constraints: { max_calories: 600, diet_type: "vegetarian" },
  meta: { timestamp: 1711929600, request_source: "schema_smoke", cache_allowed: false },
};

const minimalTrace = {
  version: "Trace_v1",
  schema_version: 1,
  compatibility: "backward",
  trace_id: "schema_smoke_trace",
  timestamp: 1711929600,
  stages: {
    interpretation_layer: { ml_used: false, ml_confidence: 0, ml_contribution_weight: 0 },
    candidate_generator: { input_count: 1, output_count: 1 },
    constraint_engine: {
      input_count: 1,
      output_count: 1,
      rejected: 0,
      rules: [],
      p0_rules_checked: 0,
      p0_violations: 0,
      p0_violated_rule_ids: [],
    },
    scoring_engine: { input_count: 1, output_count: 1 },
    diversity_engine: { input_count: 1, output_count: 1 },
    optimizer: {
      input_count: 1,
      output_count: 1,
      combinations_evaluated: 1,
      selected_score: 0.5,
    },
    reliability_engine: { input_count: 1, output_count: 1 },
  },
};

const minimalResponse = {
  version: "DecisionResponse_v1",
  schema_version: 1,
  compatibility: "backward",
  request_id: "schema_smoke_req",
  trace_id: "schema_smoke_trace",
  meal_plan: [
    { recipe_id: "r1", name: "Smoke Meal", quantity: { value: 100, unit: "grams" } },
  ],
  nutrition_summary: { calories: 400, protein: 20, carbs: 40, fat: 10 },
  score: 0.5,
  confidence: {
    version: "Confidence_v1",
    schema_version: 1,
    compatibility: "backward",
    value: 0.5,
    level: "medium",
    components: { penalty_impact: 1, diversity_impact: 1, relaxation_impact: 1 },
  },
  trace: minimalTrace,
  explanation: { deterministic: "ok", ai_explanation: "", citations: [] },
  insights: [],
  warnings: [],
  meta: { latency_ms: 0, cache_hit: false, model_version: "smoke", prompt_version: "smoke", rules_version: "smoke" },
};

(function run() {
  const r1 = validateDecisionRequest(minimalRequest);
  assert(r1.valid, `DecisionRequest schema smoke failed: ${JSON.stringify(r1.errors)}`);

  const r2 = validateTrace(minimalTrace);
  assert(r2.valid, `Trace schema smoke failed: ${JSON.stringify(r2.errors)}`);

  const r3 = validateDecisionResponse(minimalResponse);
  assert(r3.valid, `DecisionResponse schema smoke failed: ${JSON.stringify(r3.errors)}`);

  console.log("PASS: contract schema smoke (DecisionRequest, Trace, DecisionResponse)");
})();
