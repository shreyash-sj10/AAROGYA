const { buildErrorResponse } = require("../src/contracts/errorBuilder");
const { buildDecisionResponse } = require("../src/contracts/builders/decisionResponse.builder");
const assert = require("assert");

/**
 * Final Contract Validation Test
 * Ensures builders produce 100% schema-compliant objects.
 */

console.log("--- Starting Builder Validation Test ---");

const mockTrace = {
  stages: {
    candidate_generator: { input_count: 10, output_count: 5 },
    interpretation_layer: { ml_used: true, ml_confidence: 0.9, ml_contribution_weight: 0.2 },
    constraint_engine: { input_count: 5, output_count: 3, rejected: 2, rules: [], p0_rules_checked: 5, p0_violations: 0, p0_violated_rule_ids: [] },
    scoring_engine: { input_count: 3, output_count: 3 },
    diversity_engine: { input_count: 3, output_count: 2 },
    optimizer: { input_count: 2, output_count: 1, combinations_evaluated: 10, selected_score: 0.8 },
    reliability_engine: { input_count: 1, output_count: 1, relaxation_level: 0, relaxed_priorities: [], confidence_eval: { relaxation_impact: 1, pool_quality: 1, score_confidence: 1, penalty_impact: 1, diversity_impact: 1 } }
  }
};

// 1. Test ErrorResponse_v1
try {
  const errRes = buildErrorResponse({
    code: "TEST_ERROR",
    message: "Contract validation check",
    request_id: "req_123",
    trace_id: "tr_123",
    trace: mockTrace,
    meta: { timestamp: Date.now() }
  });
  
  console.log("✅ ErrorResponse_v1: Validated successfully.");
  assert(errRes.trace.version === "Trace_v1", "Trace should have Trace_v1 version");
  assert(!errRes.trace.execution, "Strict Trace_v1 should NOT have 'execution' property");
  assert(errRes.trace_debug.execution, "trace_debug SHOULD have 'execution' property");
  console.log("✅ ErrorResponse_v1: Structure check passed.");
} catch (e) {
  console.error("❌ ErrorResponse_v1: Validation failed!");
  console.error(e.message);
  process.exit(1);
}

// 2. Test DecisionResponse_v1
try {
  const decRes = buildDecisionResponse({
    request: {
      request_id: "req_456",
      trace_id: "tr_456",
      meta: { timestamp: Date.now(), latency_ms: 100, model_version: "v1", prompt_version: "v1", rules_version: "v1" }
    },
    internal: {
      mealPlan: [{ recipe_id: "r1", name: "R1", quantity: { value: 100, unit: "g" } }],
      score: 0.85,
      confidence: { value: 0.9, components: { penalty_impact: 1, diversity_impact: 1, relaxation_impact: 1 } },
      meta: { latency_ms: 100, model_version: "v1", prompt_version: "v1", rules_version: "v1" }
    },
    stageStats: mockTrace.stages
  });

  console.log("✅ DecisionResponse_v1: Validated successfully.");
  assert(decRes.trace.version === "Trace_v1", "Trace should have Trace_v1 version");
  assert(!decRes.trace.execution, "Strict Trace_v1 should NOT have 'execution' property");
  assert(decRes.trace_debug.execution, "trace_debug SHOULD have 'execution' property");
  console.log("✅ DecisionResponse_v1: Structure check passed.");
} catch (e) {
  console.error("❌ DecisionResponse_v1: Validation failed!");
  console.error(e.message);
  process.exit(1);
}

console.log("\n🚀 All Builder Contracts Hardened & Verified.");
