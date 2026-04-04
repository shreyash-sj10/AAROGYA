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

const payload = {
  version: "MetricsResponse_v1",
  request_id: "metrics_request_test",
  trace_id: "metrics_trace_test",
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
