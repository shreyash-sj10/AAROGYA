const { toSafeObject, toSafeNumber } = require("../../utils/safeUtils");

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
