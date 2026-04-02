const { recordRequest, getSnapshot, resetMetrics, percentile } = require("../src/observability/metrics");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

resetMetrics();

[10, 20, 30, 40, 100].forEach((latency) => {
  recordRequest({
    latency_ms: latency,
    pipeline_ms: latency,
    optimizer_ms: Math.max(1, Math.floor(latency / 2)),
    candidate_count: 5,
    usedFallback: false,
    confidenceLevel: "high",
  });
});

const snapshot = getSnapshot();

assert(snapshot.avg_latency === 40, `Expected avg_latency=40, got ${snapshot.avg_latency}`);
assert(snapshot.p95_latency === 100, `Expected p95_latency=100, got ${snapshot.p95_latency}`);
assert(snapshot.p99_latency === 100, `Expected p99_latency=100, got ${snapshot.p99_latency}`);
assert(percentile([10, 20, 30, 40, 100], 95) === 100, "Expected percentile helper p95=100");

console.log("PASS: metrics percentile calculation uses real samples (p95/p99)");
