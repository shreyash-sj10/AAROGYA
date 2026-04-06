const { toSafeString } = require("../../utils/safeUtils");

function nowIso() {
  return new Date().toISOString();
}

function emit(level, payload) {
  const event = {
    level,
    timestamp: nowIso(),
    ...payload,
  };

  setImmediate(() => {
    // non-blocking structured logs
    console.log(JSON.stringify(event));
  });
}

function logRequestStart({ request_id, trace_id, user_id, intent } = {}) {
  emit("info", {
    event: "request_start",
    request_id: toSafeString(request_id, "orchestrator_request"),
    trace_id: toSafeString(trace_id, "orchestrator_trace"),
    user_id: toSafeString(String(user_id || "anonymous"), "anonymous"),
    intent: toSafeString(intent, "GENERAL_QUERY"),
  });
}

function logRequestEnd({ request_id, trace_id, user_id, intent, latency_ms, status } = {}) {
  emit("info", {
    event: "request_end",
    request_id: toSafeString(request_id, "orchestrator_request"),
    trace_id: toSafeString(trace_id, "orchestrator_trace"),
    user_id: toSafeString(String(user_id || "anonymous"), "anonymous"),
    intent: toSafeString(intent, "GENERAL_QUERY"),
    latency_ms: Number.isFinite(latency_ms) ? Math.max(0, Math.round(latency_ms)) : 0,
    status: toSafeString(status, "ok"),
  });
}

function normalizeErrorType(type) {
  const safe = toSafeString(type, "SYSTEM_ERROR").toUpperCase();
  if (safe === "SCHEMA_VALIDATION_FAILED" || safe === "OPTIMIZER_FAILURE" || safe === "AI_FAILURE") {
    return safe;
  }

  return "SYSTEM_ERROR";
}

function logError({ request_id, trace_id, user_id, intent, error_type, message } = {}) {
  emit("error", {
    event: "request_error",
    request_id: toSafeString(request_id, "orchestrator_request"),
    trace_id: toSafeString(trace_id, "orchestrator_trace"),
    user_id: toSafeString(String(user_id || "anonymous"), "anonymous"),
    intent: toSafeString(intent, "GENERAL_QUERY"),
    error_type: normalizeErrorType(error_type),
    message: toSafeString(message, "Unknown error"),
  });
}

module.exports = {
  logRequestStart,
  logRequestEnd,
  logError,
};
