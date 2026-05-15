const { validateErrorResponse } = require("./validators/validateErrorResponse");
const { buildDualTrace, ensureValidTrace } = require("./utils/traceSafety");

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildErrorResponse({ code, message, details, request_id, trace_id, trace, meta } = {}) {
  const safeMeta = toSafeObject(meta);
  const safeRequestId = toSafeString(request_id || safeMeta.request_id, "unknown_request");
  const safeTraceId = toSafeString(trace_id || safeMeta.trace_id, "unknown_trace");
  const safeTimestamp = safeMeta.timestamp || Date.now();
  
  // Trace Truth Layer: Capture both raw and healed traces even on failure
  const dualTrace = buildDualTrace(trace, safeTraceId, safeTimestamp);

  // Restore contract shape: trace MUST be ONLY the safe/healed Trace_v1 object
  const safeTrace = dualTrace.safe;
  console.log("TRACE VALIDATION INPUT", safeTrace);

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
    // If we still fail here, it's a structural logic error in the builder itself
    throw new Error(`ErrorResponse_v1 validation failed: ${JSON.stringify(validation.errors || [])}`);
  }

  // Move debug data outside contract: append after validation
  payload.trace_debug = {
    execution: dualTrace.execution,
    healed: dualTrace.safe,
  };

  return payload;
}

module.exports = {
  buildErrorResponse,
};
