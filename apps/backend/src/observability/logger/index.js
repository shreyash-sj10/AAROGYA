const { toSafeString } = require("../../utils/safeUtils");
const { loggerWithRequest } = require("../pinoRoot");

function baseFields({ request_id, trace_id, user_id, intent } = {}) {
  const { getRequestContext } = require("../requestContext");
  const ctx = getRequestContext();
  return {
    requestId: toSafeString(ctx.requestId, ""),
    request_id: toSafeString(request_id, "orchestrator_request"),
    trace_id: toSafeString(trace_id, "orchestrator_trace"),
    user_id: toSafeString(String(user_id || "anonymous"), "anonymous"),
    intent: toSafeString(intent, "GENERAL_QUERY"),
  };
}

function logRequestStart({ request_id, trace_id, user_id, intent } = {}) {
  loggerWithRequest().info({
    event: "request_start",
    ...baseFields({ request_id, trace_id, user_id, intent }),
  }, "orchestrator_request_start");
}

function logRequestEnd({ request_id, trace_id, user_id, intent, latency_ms, status } = {}) {
  loggerWithRequest().info({
    event: "request_end",
    ...baseFields({ request_id, trace_id, user_id, intent }),
    latencyMs: Number.isFinite(latency_ms) ? Math.max(0, Math.round(latency_ms)) : 0,
    status: toSafeString(status, "ok"),
  }, "orchestrator_request_end");
}

function normalizeErrorType(type) {
  const safe = toSafeString(type, "SYSTEM_ERROR").toUpperCase();
  if (safe === "SCHEMA_VALIDATION_FAILED" || safe === "OPTIMIZER_FAILURE" || safe === "AI_FAILURE") {
    return safe;
  }

  return "SYSTEM_ERROR";
}

function logError({ request_id, trace_id, user_id, intent, error_type, message, failureReason } = {}) {
  loggerWithRequest().error({
    event: "request_error",
    ...baseFields({ request_id, trace_id, user_id, intent }),
    error_type: normalizeErrorType(error_type),
    message: toSafeString(message, "Unknown error"),
    failureReason: failureReason != null ? toSafeString(String(failureReason), "") : undefined,
  }, "orchestrator_request_error");
}

/**
 * Structured pipeline stage log (Phase 3): stage, latency, optional relaxation / P0 hints.
 */
function logPipelineStage({
  stage,
  latencyMs = 0,
  trace_id,
  request_id,
  input_count,
  output_count,
  rejected,
  relaxation_level,
  p0_violations,
  failureReason,
} = {}) {
  const { getRequestContext } = require("../requestContext");
  const ctx = getRequestContext();
  const safeStage = toSafeString(stage, "unknown_stage");
  const ms = Number.isFinite(latencyMs) ? Math.max(0, Number(latencyMs)) : 0;

  loggerWithRequest().info({
    event: "pipeline_stage",
    stage: safeStage,
    latencyMs: ms,
    trace_id: toSafeString(trace_id, ""),
    request_id: toSafeString(request_id, ""),
    httpRequestId: toSafeString(ctx.requestId, ""),
    input_count: input_count != null ? Math.trunc(Number(input_count)) : undefined,
    output_count: output_count != null ? Math.trunc(Number(output_count)) : undefined,
    rejected: rejected != null ? Math.trunc(Number(rejected)) : undefined,
    relaxation_level: relaxation_level != null ? Math.trunc(Number(relaxation_level)) : undefined,
    p0_violations: p0_violations != null ? Math.trunc(Number(p0_violations)) : undefined,
    failureReason: failureReason != null ? toSafeString(String(failureReason), "") : undefined,
  }, `pipeline_stage:${safeStage}`);
}

module.exports = {
  logRequestStart,
  logRequestEnd,
  logError,
  logPipelineStage,
};
