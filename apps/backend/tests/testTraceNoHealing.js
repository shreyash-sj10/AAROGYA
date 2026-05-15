const { buildDualTrace } = require("../src/contracts/utils/traceSafety");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(function runTraceNoHealingProof() {
  const rawTrace = {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: "trace_no_heal",
    timestamp: 1711929600,
    stages: {
      interpretation_layer: { ml_used: false, ml_confidence: 0, ml_contribution_weight: 0 },
      candidate_generator: { input_count: 10, output_count: 5 },
      constraint_engine: {
        input_count: 0,
        output_count: 0,
        rejected: 5,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      },
      scoring_engine: { input_count: 0, output_count: 0 },
      diversity_engine: { input_count: 0, output_count: 0 },
      optimizer: { input_count: 0, output_count: 0, combinations_evaluated: 0, selected_score: 0 },
      reliability_engine: { input_count: 0, output_count: 0 },
    },
  };

  const dual = buildDualTrace(rawTrace, rawTrace.trace_id, rawTrace.timestamp);

  assert(dual.stages.constraint_engine.input_count === 0, "Primary trace was mutated/healed");
  assert(dual.safe.stages.constraint_engine.input_count === 0, "Safe trace should not transition-heal counts");
  assert(dual.execution.stages.constraint_engine.input_count === 0, "Execution trace must preserve raw count");

  console.log("PASS: trace no-healing proof validated (raw failures preserved)");
})();
