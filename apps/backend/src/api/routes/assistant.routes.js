const crypto = require("crypto");
const Ajv = require("ajv");
const { buildErrorResponse } = require("../../contracts/errorBuilder");
const { generateExplanationWithAI } = require("../../modules/explanation/explanationEngine");
const { buildUserProfile } = require("../../modules/ai/ai.profile.service");
const { validateAIProfile } = require("../../contracts/validators/validateAIProfile");
const { validateAssistantResponse } = require("../../contracts/validators/validateAssistantResponse");
const { validateTrace } = require("../../contracts/validators/validateTrace");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });

const explainRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meal_result", "user_state"],
  properties: {
    meal_result: {
      type: "object",
      additionalProperties: true,
      required: ["meal", "score"],
      properties: {
        meal: { type: "array", items: { type: "string" } },
        score: { type: "number", minimum: 0, maximum: 1 },
        breakdown: { type: "object" },
      },
    },
    user_state: {
      type: "object",
      additionalProperties: true,
      properties: {
        conditions: { type: "array", items: { type: "string" } },
        risk_flags: { type: "array", items: { type: "string" } },
      },
    },
    trace_context: {
      type: "object",
      additionalProperties: true,
    },
  },
};

const explainDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["deterministic", "ai_explanation", "citations", "sources", "explanation", "highlights", "warnings"],
  properties: {
    deterministic: { type: "string" },
    ai_explanation: { type: "string" },
    citations: { type: "array" },
    sources: { type: "array" },
    explanation: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

const profileRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_input"],
  properties: {
    user_input: { type: "string", minLength: 1 },
    threshold: { type: "number", minimum: 0, maximum: 1 },
  },
};

const profileDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "schema_version", "compatibility", "risk_flags", "dosha_estimate", "confidence"],
  properties: {
    version: { type: "string", const: "AIProfileOutput_v1" },
    schema_version: { type: "integer", const: 1 },
    compatibility: { type: "string", enum: ["backward"] },
    risk_flags: { type: "array", items: { type: "string" } },
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
};

const validateExplainRequest = ajv.compile(explainRequestSchema);
const validateExplainData = ajv.compile(explainDataSchema);
const validateProfileRequest = ajv.compile(profileRequestSchema);
const validateProfileData = ajv.compile(profileDataSchema);

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatAjvErrors(errors) {
  return Array.isArray(errors)
    ? errors.map((entry) => ({
      instancePath: entry.instancePath || "",
      schemaPath: entry.schemaPath || "",
      keyword: entry.keyword || "",
      message: entry.message || "validation error",
    }))
    : [];
}

function createIdentity(prefix) {
  const safePrefix = toSafeString(prefix, "assistant");
  const token = crypto.randomBytes(8).toString("hex");
  return {
    request_id: `${safePrefix}_request_${token}`,
    trace_id: `${safePrefix}_trace_${token}`,
  };
}

function buildOperationalTrace(traceId, startedAt, outputCount = 1) {
  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: toSafeString(traceId, "assistant_trace"),
    timestamp: Math.max(0, Math.floor(startedAt)),
    stages: {
      candidate_generator: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      constraint_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
        rejected: 0,
        rules: [],
      },
      scoring_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      diversity_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      optimizer: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
        combinations_evaluated: 1,
        selected_score: outputCount > 0 ? 1 : 0,
      },
      reliability_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
    },
  };
}

function buildApiError(code, message, identity, details = {}) {
  const safeIdentity = toSafeObject(identity);
  return buildErrorResponse({
    code,
    message,
    request_id: toSafeString(safeIdentity.request_id, "assistant_request"),
    trace_id: toSafeString(safeIdentity.trace_id, "assistant_trace"),
    details: toSafeObject(details),
  });
}

function buildAssistantResponse(data, identity, trace) {
  const safeIdentity = toSafeObject(identity);
  const safeTrace = toSafeObject(trace);

  const traceValidation = validateTrace(safeTrace);
  if (!traceValidation.valid) {
    throw new Error(`Trace_v1 validation failed: ${JSON.stringify(traceValidation.errors || [])}`);
  }

  const payload = {
    version: "AssistantResponse_v1",
    request_id: toSafeString(safeIdentity.request_id, "assistant_request"),
    trace_id: toSafeString(safeIdentity.trace_id, "assistant_trace"),
    trace: safeTrace,
    data: toSafeObject(data),
    meta: {
      request_id: toSafeString(safeIdentity.request_id, "assistant_request"),
      trace_id: toSafeString(safeIdentity.trace_id, "assistant_trace"),
    },
  };

  const validation = validateAssistantResponse(payload);
  if (!validation.valid) {
    throw new Error(`AssistantResponse_v1 validation failed: ${JSON.stringify(validation.errors || [])}`);
  }

  return payload;
}

function registerAssistantRoutes(app) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerAssistantRoutes requires an app with post(path, ...handlers)");
  }

  app.post("/explain", async (req, res) => {
    const identity = createIdentity("explain");
    const startedAt = Date.now();

    try {
      const body = req && req.body;
      const validRequest = validateExplainRequest(body);
      if (!validRequest) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "Explain request validation failed", identity, {
          source: "api.explain",
          errors: formatAjvErrors(validateExplainRequest.errors),
        }));
      }

      const safeBody = toSafeObject(body);
      const result = await generateExplanationWithAI(
        safeBody.meal_result,
        safeBody.user_state,
        safeBody.trace_context
      );

      const validData = validateExplainData(result);
      if (!validData) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Explain response validation failed", identity, {
          source: "api.explain",
          errors: formatAjvErrors(validateExplainData.errors),
        }));
      }

      const responsePayload = buildAssistantResponse(result, identity, buildOperationalTrace(identity.trace_id, startedAt));
      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json(buildApiError("INTERNAL_ERROR", "Explain endpoint failed", identity, {
        source: "api.explain",
        reason: error instanceof Error ? error.message : "unknown_error",
      }));
    }
  });

  app.post("/profile", async (req, res) => {
    const identity = createIdentity("profile");
    const startedAt = Date.now();

    try {
      const body = req && req.body;
      const validRequest = validateProfileRequest(body);
      if (!validRequest) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "Profile request validation failed", identity, {
          source: "api.profile",
          errors: formatAjvErrors(validateProfileRequest.errors),
        }));
      }

      const safeBody = toSafeObject(body);
      const result = await buildUserProfile({
        userInput: safeBody.user_input,
        threshold: safeBody.threshold,
      });

      const aiValidation = validateAIProfile(result);
      if (!aiValidation.valid) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Profile response validation failed", identity, {
          source: "api.profile",
          errors: aiValidation.errors || [],
        }));
      }

      const schemaValidation = validateProfileData(result);
      if (!schemaValidation) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Profile envelope validation failed", identity, {
          source: "api.profile",
          errors: formatAjvErrors(validateProfileData.errors),
        }));
      }

      const responsePayload = buildAssistantResponse(result, identity, buildOperationalTrace(identity.trace_id, startedAt));
      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json(buildApiError("INTERNAL_ERROR", "Profile endpoint failed", identity, {
        source: "api.profile",
        reason: error instanceof Error ? error.message : "unknown_error",
      }));
    }
  });
}

module.exports = {
  registerAssistantRoutes,
};
