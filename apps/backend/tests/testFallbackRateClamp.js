const { recordApiRequest, recordRequest, recordAIRequest, recordAIFallback, getSnapshot, resetMetrics } = require("../src/observability/metrics");
const { validateMetricsResponse } = require("../src/contracts/validators/validateMetricsResponse");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

resetMetrics();

for (let i = 0; i < 3; i += 1) {
  recordApiRequest();
  recordRequest({
    latency_ms: 20,
    pipeline_ms: 10,
    optimizer_ms: 5,
    candidate_count: 2,
    usedFallback: true,
    confidenceLevel: "medium",
  });
}

recordAIRequest();
recordAIFallback();
recordAIFallback();
recordAIFallback();
recordAIFallback();
recordAIFallback();

const snapshot = getSnapshot();

assert(snapshot.fallback_rate <= 1, `fallback_rate must be <= 1, got ${snapshot.fallback_rate}`);
assert(snapshot.fallback_rate >= 0, `fallback_rate must be >= 0, got ${snapshot.fallback_rate}`);
assert(snapshot.ai_metrics.fallback_rate <= 1, `ai_metrics.fallback_rate must be <= 1, got ${snapshot.ai_metrics.fallback_rate}`);
assert(snapshot.engine_health && typeof snapshot.engine_health === "object", "snapshot must include engine_health");

const minimalTrace = {
  version: "Trace_v1",
  schema_version: 1,
  compatibility: "backward",
  trace_id: "metrics_trace_test",
  timestamp: Date.now(),
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
    optimizer: { input_count: 1, output_count: 1, combinations_evaluated: 1, selected_score: 0.5 },
    reliability_engine: { input_count: 1, output_count: 1 },
  },
};

const payload = {
  version: "MetricsResponse_v1",
  request_id: "metrics_request_test",
  trace_id: "metrics_trace_test",
  trace: minimalTrace,
  ...snapshot,
  meta: {
    latency_ms: 1,
    request_id: "metrics_request_test",
    trace_id: "metrics_trace_test",
  },
};

const validation = validateMetricsResponse(payload);
assert(validation.valid, `metrics payload should remain schema-valid: ${JSON.stringify(validation.errors || [])}`);

console.log("PASS: fallback rates are clamped and metrics schema stays valid under repeated fallback events");
