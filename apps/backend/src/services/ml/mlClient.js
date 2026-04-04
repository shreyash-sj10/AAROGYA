const crypto = require("crypto");
const {
  logLLMRequest,
  logLLMResponse,
  logLLMValidation,
  logLLMFallback,
} = require("../../observability/llm.logger");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "https://ayudiet-llm-model.onrender.com").replace(/\/$/, "");
const AI_PROFILE_URL = process.env.AYUDIET_AI_PROFILE_URL || `${AI_SERVICE_URL}/ai/profile`;
const AI_EXPLAIN_URL = process.env.AYUDIET_AI_EXPLAIN_URL || `${AI_SERVICE_URL}/ai/explain`;
const AI_FEEDBACK_URL = process.env.AYUDIET_AI_FEEDBACK_URL || `${AI_SERVICE_URL}/ai/feedback`;
const AI_HEALTH_URL = `${AI_SERVICE_URL}/health`;
const ML_PARSE_URL = process.env.AYUDIET_ML_PARSE_URL || `${AI_SERVICE_URL}/symptoms`;
const USE_ML = String(process.env.USE_ML || "true").trim().toLowerCase() !== "false";

const logger = {
  error(message, meta = {}) {
    const safeMeta = meta && typeof meta === "object" ? meta : {};
    const errMessage = safeMeta.err instanceof Error ? safeMeta.err.message : "";

    logError({
      error_type: "SYSTEM_ERROR",
      message: errMessage ? `${message}: ${errMessage}` : message,
    });
  },
};

const metrics = {
  increment() {
    recordError("SYSTEM_ERROR");
  },
};
function logMLServiceFallback(reason, requestId = "ml_fallback") {
  const detail = typeof reason === "string" && reason.trim() ? reason.trim() : "fallback";
  logLLMFallback({ endpoint: "ml/service", request_id: requestId, reason: detail });
  console.warn(`[ml] service_unavailable_using_fallback: ${detail}`);
}

const TIMEOUT_MS = Number(process.env.AYUDIET_AI_TIMEOUT_MS || 2000);
const MAX_RETRIES = 0;
const HEALTH_RECHECK_MS = 30000;

const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.AYUDIET_AI_CB_THRESHOLD || 3);
const CIRCUIT_COOLDOWN_MS = Number(process.env.AYUDIET_AI_CB_COOLDOWN_MS || 30000);

const AI_FORBIDDEN_KEYS = new Set([
  "meal",
  "selection",
  "recipe_id",
  "ranking",
]);

const REQUEST_SCHEMAS = {
  profile: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1 },
    },
  },
  explain: {
    type: "object",
    additionalProperties: false,
    required: ["context", "reasoning"],
    properties: {
      context: {
        type: "object",
        additionalProperties: false,
        required: ["risk_flags", "selected_recipes", "user_conditions", "highlights", "warnings"],
        properties: {
          risk_flags: { type: "array", items: { type: "string" } },
          selected_recipes: { type: "array", items: { type: "string" } },
          user_conditions: { type: "array", items: { type: "string" } },
          highlights: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
      reasoning: {
        type: "object",
        additionalProperties: false,
        required: ["trace", "total_score"],
        properties: {
          trace: { type: "array", items: { type: "string" } },
          total_score: { type: "number" },
        },
      },
    },
  },
  feedback: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1 },
    },
  },
  symptoms: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1 },
    },
  },
};

const RESPONSE_SCHEMAS = {
  profile: {
    type: "object",
    additionalProperties: false,
    required: ["risk_flags", "goals", "symptoms", "dosha_estimate", "confidence"],
    properties: {
      risk_flags: { type: "array", items: { type: "string" } },
      goals: { type: "array", items: { type: "string" } },
      symptoms: { type: "array", items: { type: "string" } },
      dosha_estimate: {
        type: "object",
        additionalProperties: false,
        required: ["vata", "pitta", "kapha"],
        properties: {
          vata: { type: "number", minimum: 0, maximum: 1 },
          pitta: { type: "number", minimum: 0, maximum: 1 },
          kapha: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
  explain: {
    type: "object",
    additionalProperties: false,
    required: ["explanation", "citations"],
    properties: {
      explanation: { type: "string" },
      citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text_id", "source", "chapter"],
          properties: {
            text_id: { type: "string", minLength: 1 },
            source: { type: "string", minLength: 1 },
            chapter: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  feedback: {
    type: "object",
    additionalProperties: false,
    required: ["feedback_type", "target"],
    properties: {
      feedback_type: { type: "string", enum: ["LIKE", "DISLIKE", "REPLACE"] },
      target: { type: "string" },
    },
  },
  symptoms: {
    type: "object",
    additionalProperties: false,
    required: ["symptoms"],
    properties: {
      symptoms: { type: "array", items: { type: "string" } },
    },
  },
};

const healthState = {
  healthy: false,
  checked: false,
  lastCheckedAt: 0,
  inFlight: null,
};

const circuitState = {
  state: "closed",
  failureCount: 0,
  openedAt: 0,
};

function toSafeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function createAIBoundaryError(message) {
  const error = new Error(`AI Boundary Error: ${message}`);
  error.name = "AIBoundaryError";
  return error;
}

function isAIBoundaryError(error) {
  return Boolean(error && typeof error === "object" && error.name === "AIBoundaryError");
}

function isCircuitOpen() {
  if (circuitState.state !== "open") {
    return false;
  }

  const elapsed = Date.now() - circuitState.openedAt;
  if (elapsed >= CIRCUIT_COOLDOWN_MS) {
    circuitState.state = "half_open";
    return false;
  }

  return true;
}

function recordCircuitFailure() {
  if (circuitState.state === "half_open") {
    circuitState.state = "open";
    circuitState.failureCount = Math.max(1, CIRCUIT_FAILURE_THRESHOLD);
    circuitState.openedAt = Date.now();
    return;
  }

  circuitState.failureCount += 1;

  if (circuitState.failureCount >= Math.max(1, CIRCUIT_FAILURE_THRESHOLD)) {
    circuitState.state = "open";
    circuitState.openedAt = Date.now();
  }
}

function recordCircuitSuccess() {
  circuitState.failureCount = 0;
  circuitState.state = "closed";
  circuitState.openedAt = 0;
}

function validateAgainstSchema(value, schema, path = "$") {
  const errors = [];

  function addError(message, errorPath) {
    errors.push({ path: errorPath, message });
  }

  function validateNode(nodeValue, nodeSchema, nodePath) {
    if (!nodeSchema || typeof nodeSchema !== "object") {
      return;
    }

    if (nodeSchema.const !== undefined && nodeValue !== nodeSchema.const) {
      addError(`must be equal to constant ${JSON.stringify(nodeSchema.const)}`, nodePath);
      return;
    }

    if (Array.isArray(nodeSchema.enum) && !nodeSchema.enum.includes(nodeValue)) {
      addError(`must be one of ${nodeSchema.enum.join(", ")}`, nodePath);
      return;
    }

    if (nodeSchema.type === "object") {
      if (!nodeValue || typeof nodeValue !== "object" || Array.isArray(nodeValue)) {
        addError("must be an object", nodePath);
        return;
      }

      const props = nodeSchema.properties && typeof nodeSchema.properties === "object" ? nodeSchema.properties : {};
      const required = Array.isArray(nodeSchema.required) ? nodeSchema.required : [];

      required.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(nodeValue, key)) {
          addError(`missing required property: ${key}`, nodePath);
        }
      });

      if (nodeSchema.additionalProperties === false) {
        Object.keys(nodeValue).forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(props, key)) {
            addError(`unknown property: ${key}`, nodePath);
          }
        });
      }

      Object.keys(props).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(nodeValue, key)) {
          validateNode(nodeValue[key], props[key], `${nodePath}.${key}`);
        }
      });
      return;
    }

    if (nodeSchema.type === "array") {
      if (!Array.isArray(nodeValue)) {
        addError("must be an array", nodePath);
        return;
      }

      if (typeof nodeSchema.minItems === "number" && nodeValue.length < nodeSchema.minItems) {
        addError(`must contain at least ${nodeSchema.minItems} items`, nodePath);
      }

      if (nodeSchema.items) {
        nodeValue.forEach((item, index) => {
          validateNode(item, nodeSchema.items, `${nodePath}[${index}]`);
        });
      }
      return;
    }

    if (nodeSchema.type === "string") {
      if (typeof nodeValue !== "string") {
        addError("must be a string", nodePath);
        return;
      }

      if (typeof nodeSchema.minLength === "number" && nodeValue.length < nodeSchema.minLength) {
        addError(`must have length >= ${nodeSchema.minLength}`, nodePath);
      }
      return;
    }

    if (nodeSchema.type === "number") {
      if (typeof nodeValue !== "number" || !Number.isFinite(nodeValue)) {
        addError("must be a finite number", nodePath);
        return;
      }

      if (typeof nodeSchema.minimum === "number" && nodeValue < nodeSchema.minimum) {
        addError(`must be >= ${nodeSchema.minimum}`, nodePath);
      }

      if (typeof nodeSchema.maximum === "number" && nodeValue > nodeSchema.maximum) {
        addError(`must be <= ${nodeSchema.maximum}`, nodePath);
      }
      return;
    }

    if (nodeSchema.type === "boolean" && typeof nodeValue !== "boolean") {
      addError("must be a boolean", nodePath);
    }
  }

  validateNode(value, schema, path);
  return { valid: errors.length === 0, errors };
}

function assertSchema(schemaName, stage, value, schema, endpoint, requestId) {
  const validation = validateAgainstSchema(value, schema);
  logLLMValidation({
    endpoint,
    request_id: requestId,
    valid: validation.valid,
    errors: validation.errors,
  });

  if (!validation.valid) {
    logLLMFallback({ endpoint, request_id: requestId, reason: `${schemaName}_${stage}_invalid` });
    throw createAIBoundaryError(`${schemaName} ${stage} schema validation failed`);
  }
}

function assertNoForbiddenKeys(obj) {
  function scan(value) {
    if (value === null || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }

    for (const key of Object.keys(value)) {
      const normalizedKey = String(key).trim().toLowerCase();
      if (AI_FORBIDDEN_KEYS.has(normalizedKey)) {
        throw createAIBoundaryError(`forbidden decision field: ${key}`);
      }
      scan(value[key]);
    }
  }

  scan(obj);
}

function needsHealthRefresh() {
  if (!healthState.checked) {
    return true;
  }

  return (Date.now() - healthState.lastCheckedAt) >= HEALTH_RECHECK_MS;
}

async function checkAIHealth() {
  if (!USE_ML) {
    healthState.healthy = false;
    healthState.checked = true;
    healthState.lastCheckedAt = Date.now();
    logMLServiceFallback("USE_ML_disabled", "ml_health_disabled");
    return false;
  }

  if (healthState.inFlight) {
    return healthState.inFlight;
  }

  const requestId = `llm_health_${crypto.randomBytes(4).toString("hex")}`;
  const run = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    logLLMRequest({ endpoint: "health", request_id: requestId, payload: { url: AI_HEALTH_URL } });

    try {
      const startedAt = Date.now();
      const response = await fetch(AI_HEALTH_URL, {
        method: "GET",
        signal: controller.signal,
      });
      const latency = Date.now() - startedAt;

      if (!response.ok) {
        healthState.healthy = false;
        healthState.checked = true;
        healthState.lastCheckedAt = Date.now();
        logLLMResponse({
          endpoint: "health",
          request_id: requestId,
          ok: false,
          latency_ms: latency,
          response: { status: response.status },
        });
        logLLMFallback({ endpoint: "health", request_id: requestId, reason: "health_check_failed" });
        return false;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      const isHealthy = Boolean(payload && payload.status === "ok");
      healthState.healthy = isHealthy;
      healthState.checked = true;
      healthState.lastCheckedAt = Date.now();

      logLLMValidation({
        endpoint: "health",
        request_id: requestId,
        valid: isHealthy,
        errors: isHealthy ? [] : [{ message: "Health payload mismatch" }],
      });

      logLLMResponse({
        endpoint: "health",
        request_id: requestId,
        ok: isHealthy,
        latency_ms: latency,
        response: payload || { status: "unknown" },
      });

      if (!isHealthy) {
        logLLMFallback({ endpoint: "health", request_id: requestId, reason: "health_payload_invalid" });
      }

      return isHealthy;
    } catch (error) {
      healthState.healthy = false;
      healthState.checked = true;
      healthState.lastCheckedAt = Date.now();
      logLLMResponse({
        endpoint: "health",
        request_id: requestId,
        ok: false,
        latency_ms: 0,
        response: { error: error instanceof Error ? error.message : "health_request_failed" },
      });
      logLLMFallback({ endpoint: "health", request_id: requestId, reason: "health_check_exception" });
      return false;
    } finally {
      clearTimeout(timeout);
      healthState.inFlight = null;
    }
  })();

  healthState.inFlight = run;
  return run;
}

async function getHealthStatus() {
  if (needsHealthRefresh()) {
    await checkAIHealth();
  }

  return healthState.healthy;
}

async function safeFetch(url, body, meta = {}) {
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  const requestId = toSafeString(safeMeta.request_id || `llm_${crypto.randomBytes(6).toString("hex")}`);

  if (!USE_ML) {
    logMLServiceFallback("USE_ML_disabled", requestId);
    throw createAIBoundaryError("service unavailable");
  }

  if (isCircuitOpen()) {
    logLLMFallback({ endpoint: url, request_id: requestId, reason: "circuit_open" });
    throw createAIBoundaryError("service unavailable");
  }

  const healthy = await getHealthStatus();
  if (!healthy) {
    recordCircuitFailure();
    logLLMFallback({ endpoint: url, request_id: requestId, reason: "ai_unhealthy" });
    throw createAIBoundaryError("service unavailable");
  }

  logLLMRequest({ endpoint: url, request_id: requestId, payload: body });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const startedAt = Date.now();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": toSafeString(process.env.AI_SERVICE_API_KEY || ""),
          "x-request-id": toSafeString(safeMeta.request_id || requestId),
          "x-trace-id": toSafeString(safeMeta.trace_id || ""),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const latency = Date.now() - startedAt;

      if (!res.ok) {
        logLLMResponse({
          endpoint: url,
          request_id: requestId,
          ok: false,
          latency_ms: latency,
          response: { status: res.status, attempt },
        });
        continue;
      }

      let json = null;
      try {
        json = await res.json();
      } catch (error) {
        logLLMValidation({
          endpoint: url,
          request_id: requestId,
          valid: false,
          errors: [{ message: "Invalid JSON response" }],
        });
        continue;
      }

      logLLMResponse({
        endpoint: url,
        request_id: requestId,
        ok: true,
        latency_ms: latency,
        response: json,
      });

      const validEnvelope = Boolean(json && typeof json === "object" && json.success === true);
      logLLMValidation({
        endpoint: url,
        request_id: requestId,
        valid: validEnvelope,
        errors: validEnvelope ? [] : [{ message: "Envelope validation failed: success !== true" }],
      });

      if (!validEnvelope) {
        continue;
      }

      recordCircuitSuccess();
      return json.data;
    } catch (error) {
      logLLMResponse({
        endpoint: url,
        request_id: requestId,
        ok: false,
        latency_ms: 0,
        response: { error: error instanceof Error ? error.message : "ai_request_failed", attempt },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  recordCircuitFailure();
  logLLMFallback({ endpoint: url, request_id: requestId, reason: "safe_fetch_failed" });
  throw createAIBoundaryError("invalid response");
}

async function callML(endpoint, payload, meta = {}) {
  const normalizedEndpoint = toSafeString(endpoint).replace(/^\/+/, "");
  if (!normalizedEndpoint) {
    throw new Error("ML endpoint is required");
  }

  const url = normalizedEndpoint.startsWith("http")
    ? normalizedEndpoint
    : `${AI_SERVICE_URL}/${normalizedEndpoint}`;

  return safeFetch(url, payload, meta);
}
function sanitizeProfile(data) {
  const safe = toSafeObject(data);
  return {
    risk_flags: toSafeArray(safe.risk_flags)
      .filter((f) => typeof f === "string")
      .map((f) => f.trim())
      .filter(Boolean),
    goals: toSafeArray(safe.goals)
      .filter((f) => typeof f === "string")
      .map((f) => f.trim())
      .filter(Boolean),
    symptoms: toSafeArray(safe.symptoms)
      .filter((f) => typeof f === "string")
      .map((f) => f.trim())
      .filter(Boolean),
    dosha_estimate: {
      vata: safe.dosha_estimate.vata,
      pitta: safe.dosha_estimate.pitta,
      kapha: safe.dosha_estimate.kapha,
    },
    confidence: safe.confidence,
  };
}

function inferProfileGoalsAndSymptoms(text) {
  const normalized = toSafeString(text).toLowerCase();
  const goals = [];
  const symptoms = [];

  if (["weight", "fat", "obese", "loss"].some((token) => normalized.includes(token))) {
    goals.push("GOAL_WEIGHT_LOSS");
  }

  if (["sugar", "glucose", "diabetes"].some((token) => normalized.includes(token))) {
    goals.push("GOAL_GLUCOSE_CONTROL");
  }

  if (goals.length === 0) {
    goals.push("GOAL_MAINTENANCE");
  }

  if (["acidity", "acid", "heartburn", "burning"].some((token) => normalized.includes(token))) {
    symptoms.push("acidity");
  }

  if (["bloating", "bloated", "gas"].some((token) => normalized.includes(token))) {
    symptoms.push("bloating");
  }

  if (["fatigue", "tired", "low energy"].some((token) => normalized.includes(token))) {
    symptoms.push("fatigue");
  }

  return {
    goals: Array.from(new Set(goals)),
    symptoms: Array.from(new Set(symptoms)),
  };
}

function normalizeDosha(value) {
  const safe = toSafeObject(value);
  const vata = Number.isFinite(safe.vata) ? safe.vata : 0;
  const pitta = Number.isFinite(safe.pitta) ? safe.pitta : 0;
  const kapha = Number.isFinite(safe.kapha) ? safe.kapha : 0;
  const total = Math.max(0, vata) + Math.max(0, pitta) + Math.max(0, kapha);

  if (total <= 0) {
    return { vata: 0.34, pitta: 0.33, kapha: 0.33 };
  }

  const nv = Math.max(0, vata) / total;
  const np = Math.max(0, pitta) / total;
  return {
    vata: Number(nv.toFixed(6)),
    pitta: Number(np.toFixed(6)),
    kapha: Number((1 - nv - np).toFixed(6)),
  };
}

function buildProfileFallback(text) {
  const inferred = inferProfileGoalsAndSymptoms(text);
  return {
    risk_flags: [],
    goals: inferred.goals,
    symptoms: inferred.symptoms,
    dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    confidence: 0.3,
  };
}

function normalizeProfileResponse(data, originalText) {
  const safe = toSafeObject(data);
  const inferred = inferProfileGoalsAndSymptoms(originalText);
  const riskFlags = toSafeArray(safe.risk_flags)
    .filter((f) => typeof f === "string")
    .map((f) => f.trim())
    .filter(Boolean);
  const goals = toSafeArray(safe.goals)
    .filter((f) => typeof f === "string")
    .map((f) => f.trim())
    .filter(Boolean);
  const symptoms = toSafeArray(safe.symptoms)
    .filter((f) => typeof f === "string")
    .map((f) => f.trim())
    .filter(Boolean);
  const confidence = Number.isFinite(safe.confidence) ? Math.min(1, Math.max(0, safe.confidence)) : 0.3;

  return {
    risk_flags: riskFlags,
    goals: goals.length > 0 ? goals : inferred.goals,
    symptoms: symptoms.length > 0 ? symptoms : inferred.symptoms,
    dosha_estimate: normalizeDosha(safe.dosha_estimate),
    confidence,
  };
}

function normalizeSymptomsResponse(data) {
  const safe = toSafeObject(data);
  const direct = toSafeArray(safe.symptoms);
  const legacy = toSafeArray(safe.symptom_tags);
  const merged = (direct.length > 0 ? direct : legacy)
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => tag.trim().toLowerCase());
  return {
    symptoms: Array.from(new Set(merged)),
  };
}

function sanitizeExplanation(data) {
  const safe = toSafeObject(data);
  return {
    explanation: toSafeString(safe.explanation),
    citations: toSafeArray(safe.citations).map((item) => ({
      text_id: toSafeString(item.text_id),
      source: toSafeString(item.source),
      chapter: toSafeString(item.chapter),
    })),
  };
}

function sanitizeFeedback(data) {
  const safe = toSafeObject(data);
  return {
    feedback_type: toSafeString(safe.feedback_type).toUpperCase(),
    target: toSafeString(safe.target).toLowerCase().replace(/[^a-z0-9_ -]/g, "").trim(),
  };
}

async function getAIProfile(text, meta = {}) {
  const safeInput = toSafeString(text);
  const safeMeta = toSafeObject(meta);
  const requestId = toSafeString(safeMeta.request_id, "llm_profile");
  const requestPayload = { text: safeInput };

  assertSchema("profile", "request", requestPayload, REQUEST_SCHEMAS.profile, "ai/profile", requestId);
  try {
    const data = await safeFetch(AI_PROFILE_URL, requestPayload, meta);
    const normalized = normalizeProfileResponse(data, safeInput);
    assertNoForbiddenKeys(normalized);
    assertSchema("profile", "response", normalized, RESPONSE_SCHEMAS.profile, "ai/profile", requestId);
    return sanitizeProfile(normalized);
  } catch (error) {
    if (!isAIBoundaryError(error)) {
      throw error;
    }
    logLLMFallback({ endpoint: "ai/profile", request_id: requestId, reason: "profile_fallback" });
    return buildProfileFallback(safeInput);
  }
}

async function getExplanation(payload, meta = {}) {
  const safePayload = toSafeObject(payload);
  const safeMeta = toSafeObject(meta);
  const requestId = toSafeString(safeMeta.request_id, "llm_explain");
  const safeContext = toSafeObject(safePayload.context);
  const safeReasoning = toSafeObject(safePayload.reasoning);
  const requestPayload = {
    context: {
      risk_flags: toSafeArray(safeContext.risk_flags).map((item) => toSafeString(item)).filter(Boolean),
      selected_recipes: toSafeArray(safeContext.selected_recipes).map((item) => toSafeString(item)).filter(Boolean),
      user_conditions: toSafeArray(safeContext.user_conditions).map((item) => toSafeString(item)).filter(Boolean),
      highlights: toSafeArray(safeContext.highlights).map((item) => toSafeString(item)).filter(Boolean),
      warnings: toSafeArray(safeContext.warnings).map((item) => toSafeString(item)).filter(Boolean),
    },
    reasoning: {
      trace: toSafeArray(safeReasoning.trace).map((item) => toSafeString(item)).filter(Boolean),
      total_score: Number.isFinite(safeReasoning.total_score) ? safeReasoning.total_score : 0,
    },
  };

  assertSchema("explain", "request", requestPayload, REQUEST_SCHEMAS.explain, "ai/explain", requestId);

  if (!USE_ML) {
    logMLServiceFallback("USE_ML_disabled", requestId);
    return {
      explanation: "AI explanation unavailable in local fallback mode.",
      citations: [],
    };
  }

  try {
    const data = await safeFetch(AI_EXPLAIN_URL, requestPayload, meta);
    assertNoForbiddenKeys(data);
    assertSchema("explain", "response", data, RESPONSE_SCHEMAS.explain, "ai/explain", requestId);
    return sanitizeExplanation(data);
  } catch (error) {
    if (isAIBoundaryError(error)) {
      logMLServiceFallback("explain_fallback", requestId);
      return {
        explanation: "AI explanation unavailable in local fallback mode.",
        citations: [],
      };
    }
    throw error;
  }
}

async function parseFeedback(text, meta = {}) {
  const safeMeta = toSafeObject(meta);
  const requestId = toSafeString(safeMeta.request_id, "llm_feedback");
  const requestPayload = { text: toSafeString(text) };

  assertSchema("feedback", "request", requestPayload, REQUEST_SCHEMAS.feedback, "ai/feedback", requestId);
  try {
    const data = await safeFetch(AI_FEEDBACK_URL, requestPayload, meta);
    assertNoForbiddenKeys(data);
    assertSchema("feedback", "response", data, RESPONSE_SCHEMAS.feedback, "ai/feedback", requestId);
    return sanitizeFeedback(data);
  } catch (error) {
    if (!isAIBoundaryError(error)) {
      throw error;
    }
    logLLMFallback({ endpoint: "ai/feedback", request_id: requestId, reason: "feedback_fallback" });
    return {
      feedback_type: "DISLIKE",
      target: "",
    };
  }
}

async function parseFeedbackWithLLM(feedbackInput, meta = {}) {
  return parseFeedback(feedbackInput, meta);
}

async function parseSymptoms(text, meta = {}) {
  const safeMeta = toSafeObject(meta);
  const requestId = toSafeString(safeMeta.request_id, "llm_symptoms");
  const requestPayload = { text: toSafeString(text) };

  assertSchema("symptoms", "request", requestPayload, REQUEST_SCHEMAS.symptoms, "ml/parse", requestId);
  try {
    const data = await safeFetch(ML_PARSE_URL, requestPayload, meta);
    const normalized = normalizeSymptomsResponse(data);
    assertNoForbiddenKeys(normalized);
    assertSchema("symptoms", "response", normalized, RESPONSE_SCHEMAS.symptoms, "ml/parse", requestId);
    return {
      symptoms: normalized.symptoms,
      symptom_tags: normalized.symptoms,
    };
  } catch (error) {
    if (!isAIBoundaryError(error)) {
      throw error;
    }
    logLLMFallback({ endpoint: "ml/parse", request_id: requestId, reason: "parse_fallback" });
    return {
      symptoms: [],
      symptom_tags: [],
    };
  }
}

module.exports = {
  callML,
  safeFetch,
  getAIProfile,
  getExplanation,
  parseFeedback,
  parseFeedbackWithLLM,
  parseSymptoms,
  checkAIHealth,
  getHealthStatus,
  assertNoForbiddenKeys,
  _circuitState: circuitState,
};





