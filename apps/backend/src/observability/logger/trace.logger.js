function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function logTrace(tracePayload = {}) {
  const safe = toSafeObject(tracePayload);
  const trace = {
    event: "decision_trace",
    request_id: safe.request_id || "orchestrator_request",
    trace_id: safe.trace_id || "orchestrator_trace",
    candidatesCount: toSafeNumber(safe.candidatesCount, 0),
    rejectedCount: toSafeNumber(safe.rejectedCount, 0),
    totalScore: toSafeNumber(safe.totalScore, 0),
    penalties: toSafeNumber(safe.penalties, 0),
    optimizerSteps: toSafeNumber(safe.optimizerSteps, 0),
    timestamp: new Date().toISOString(),
  };

  setImmediate(() => {
    console.log(JSON.stringify(trace));
  });
}

module.exports = {
  logTrace,
};
