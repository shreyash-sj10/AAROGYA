const {
  recordAIRequest,
  recordAIResponse,
  recordAIValidation,
  recordAIFallback,
} = require("../metrics");
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
    console.log(JSON.stringify(event));
  });
}

function logLLMRequest({ endpoint, request_id, payload } = {}) {
  recordAIRequest();
  emit("info", {
    event: "llm_request",
    endpoint: toSafeString(endpoint, "unknown"),
    request_id: toSafeString(request_id, "llm_request"),
    payload,
  });
}

function logLLMResponse({ endpoint, request_id, ok, latency_ms, response } = {}) {
  const safeLatency = Number.isFinite(latency_ms) ? Math.max(0, Math.round(latency_ms)) : 0;
  recordAIResponse(safeLatency);

  emit("info", {
    event: "llm_response",
    endpoint: toSafeString(endpoint, "unknown"),
    request_id: toSafeString(request_id, "llm_request"),
    ok: Boolean(ok),
    latency_ms: safeLatency,
    response,
  });
}

function logLLMValidation({ endpoint, request_id, valid, errors } = {}) {
  recordAIValidation(Boolean(valid));

  emit(valid ? "info" : "warn", {
    event: "llm_validation",
    endpoint: toSafeString(endpoint, "unknown"),
    request_id: toSafeString(request_id, "llm_request"),
    valid: Boolean(valid),
    errors: Array.isArray(errors) ? errors : [],
  });
}

function logLLMFallback({ endpoint, request_id, reason } = {}) {
  recordAIFallback();

  emit("warn", {
    event: "llm_fallback",
    endpoint: toSafeString(endpoint, "unknown"),
    request_id: toSafeString(request_id, "llm_request"),
    reason: toSafeString(reason, "fallback_triggered"),
  });
}

module.exports = {
  logLLMRequest,
  logLLMResponse,
  logLLMValidation,
  logLLMFallback,
};

