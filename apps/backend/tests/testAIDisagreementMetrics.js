const {
  recordAIRequest,
  recordAIResponse,
  recordAIValidation,
  recordAIFallback,
  recordAIDisagreement,
  getSnapshot,
  resetMetrics,
} = require("../src/observability/metrics");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

resetMetrics();

recordAIRequest();
recordAIRequest();
recordAIResponse(40);
recordAIResponse(120);
recordAIValidation(true);
recordAIValidation(false);
recordAIFallback();

recordAIDisagreement({ ai_suggestion: "meal_a", final_decision: "meal_b" });
recordAIDisagreement({ ai_suggestion: ["meal_c"], final_decision: ["meal_c"] });
recordAIDisagreement({ ai_suggestion: "", final_decision: "meal_d" });

const snapshot = getSnapshot();

assert(snapshot.ai_metrics.request_count === 2, "ai request_count should be 2");
assert(snapshot.ai_metrics.response_count === 2, "ai response_count should be 2");
assert(snapshot.ai_metrics.schema_valid_count === 1, "schema_valid_count should be 1");
assert(snapshot.ai_metrics.schema_invalid_count === 1, "schema_invalid_count should be 1");
assert(snapshot.ai_metrics.fallback_count === 1, "fallback_count should be 1");
assert(snapshot.ai_metrics.schema_compliance_rate === 0.5, "schema_compliance_rate should be 0.5");
assert(snapshot.ai_metrics.invalid_response_rate === 0.5, "invalid_response_rate should be 0.5");
assert(snapshot.ai_metrics.fallback_rate === 0.5, "fallback_rate should be 0.5");
assert(snapshot.ai_metrics.avg_latency_ms === 80, "avg_latency_ms should be 80");
assert(snapshot.ai_metrics.latency_histogram.le_50ms === 1, "le_50ms bucket should be 1");
assert(snapshot.ai_metrics.latency_histogram.le_250ms === 1, "le_250ms bucket should be 1");

assert(snapshot.ai_disagreement.compared_count === 2, "compared_count should be 2");
assert(snapshot.ai_disagreement.mismatch_count === 1, "mismatch_count should be 1");
assert(snapshot.ai_disagreement.mismatch_rate === 0.5, "mismatch_rate should be 0.5");

console.log("PASS: AI metrics aggregation and disagreement tracking are correct");
