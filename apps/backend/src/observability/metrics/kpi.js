const { getSnapshot } = require("./index");

const buckets = [];

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function recordKPI(data = {}) {
  const snapshot = getSnapshot();
  const entry = {
    timestamp: new Date().toISOString(),
    p0_violation_rate: toSafeNumber(data.p0_violation_rate, 0),
    fallback_rate: snapshot.fallback_rate,
    p95_latency: toSafeNumber(snapshot.p95_latency, 0),
    confidence_avg: toSafeNumber(data.confidence_avg, 0),
    user_acceptance_rate: toSafeNumber(data.user_acceptance_rate, 0),
    errors: snapshot.errors,
  };

  buckets.push(entry);
  if (buckets.length > 500) {
    buckets.shift();
  }

  if (entry.fallback_rate > 0.5 || entry.p95_latency > 1200 || entry.confidence_avg < 0.4 || entry.p0_violation_rate > 0) {
    setImmediate(() => {
      console.warn(JSON.stringify({ event: "kpi_alert", ...entry }));
    });
  }

  return entry;
}

function getDashboardData() {
  const snapshot = getSnapshot();

  return {
    latency: snapshot.avg_latency,
    p95_latency: toSafeNumber(snapshot.p95_latency, 0),
    fallback_rate: snapshot.fallback_rate,
    confidence_distribution: snapshot.confidence_distribution,
    errors: snapshot.errors,
  };
}

module.exports = {
  recordKPI,
  getDashboardData,
};

