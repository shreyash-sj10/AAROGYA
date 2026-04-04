const { validateErrorResponse } = require("./validators/validateErrorResponse");

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildMinimalTrace(traceId) {
  const safeTraceId = toSafeString(traceId, "unknown_trace");
  const now = Math.max(0, Math.floor(Date.now()));

  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: safeTraceId,
    timestamp: now,
    stages: {
      candidate_generator: {
        input_count: 1,
        output_count: 0,
      },
      constraint_engine: {
        input_count: 1,
        output_count: 0,
        rejected: 1,
        rules: [
          {
            rule_id: "error_boundary",
            action: "reject",
            reason: "response_failed",
          },
        ],
      },
      scoring_engine: {
        input_count: 0,
        output_count: 0,
      },
      diversity_engine: {
        input_count: 0,
        output_count: 0,
      },
      optimizer: {
        input_count: 0,
        output_count: 0,
        combinations_evaluated: 0,
        selected_score: 0,
      },
      reliability_engine: {
        input_count: 1,
        output_count: 0,
      },
    },
  };
}

function normalizeTrace(traceInput, traceId) {
  const fallbackTrace = buildMinimalTrace(traceId);
  const safeTrace = toSafeObject(traceInput);
  const safeStages = toSafeObject(safeTrace.stages);

  if (!safeTrace.version || !safeTrace.schema_version || !safeTrace.compatibility || !safeTrace.trace_id || !safeTrace.timestamp || Object.keys(safeStages).length === 0) {
    return fallbackTrace;
  }

  return {
    ...safeTrace,
    trace_id: toSafeString(safeTrace.trace_id, toSafeString(traceId, "unknown_trace")),
    timestamp: Math.max(0, Math.floor(toSafeNumber(safeTrace.timestamp, Date.now()))),
  };
}

function buildErrorResponse({ code, message, details, request_id, trace_id, trace, meta } = {}) {
  const safeMeta = toSafeObject(meta);
  const safeRequestId = toSafeString(request_id || safeMeta.request_id, "unknown_request");
  const safeTraceId = toSafeString(trace_id || safeMeta.trace_id, "unknown_trace");
  const safeTrace = normalizeTrace(trace, safeTraceId);

  const payload = {
    version: "ErrorResponse_v1",
    request_id: safeRequestId,
    trace_id: safeTraceId,
    trace: safeTrace,
    error: {
      code: toSafeString(code, "INTERNAL_ERROR"),
      message: toSafeString(message, "Internal server error"),
      details: toSafeObject(details),
    },
  };

  const validation = validateErrorResponse(payload);
  if (!validation.valid) {
    throw new Error(`ErrorResponse_v1 validation failed: ${JSON.stringify(validation.errors || [])}`);
  }

  return payload;
}

module.exports = {
  buildErrorResponse,
  buildMinimalTrace,
};
