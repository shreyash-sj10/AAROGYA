const crypto = require("crypto");
const Ajv = require("ajv");
const { buildErrorResponse } = require("../../contracts/errorBuilder");
const { generateExplanationWithAI } = require("../../modules/explanation/explanationEngine");
const { buildUserProfile } = require("../../modules/ai/ai.profile.service");
const { validateAIProfile } = require("../../contracts/validators/validateAIProfile");

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

const explainResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "trace_id", "deterministic", "ai_explanation", "citations", "sources", "explanation", "highlights", "warnings"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
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

const profileResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "trace_id", "version", "schema_version", "compatibility", "risk_flags", "dosha_estimate", "confidence"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
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
const validateExplainResponse = ajv.compile(explainResponseSchema);
const validateProfileRequest = ajv.compile(profileRequestSchema);
const validateProfileResponse = ajv.compile(profileResponseSchema);

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

function buildApiError(code, message, details = {}) {
  return buildErrorResponse({
    code,
    message,
    details: toSafeObject(details),
  });
}

function registerAssistantRoutes(app) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerAssistantRoutes requires an app with post(path, ...handlers)");
  }

  app.post("/explain", async (req, res) => {
    const identity = createIdentity("explain");

    try {
      const body = req && req.body;
      const validRequest = validateExplainRequest(body);
      if (!validRequest) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "Explain request validation failed", {
          source: "api.explain",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          errors: formatAjvErrors(validateExplainRequest.errors),
        }));
      }

      const safeBody = toSafeObject(body);
      const result = await generateExplanationWithAI(
        safeBody.meal_result,
        safeBody.user_state,
        safeBody.trace_context
      );

      const responsePayload = {
        request_id: identity.request_id,
        trace_id: identity.trace_id,
        ...result,
      };

      const validResponse = validateExplainResponse(responsePayload);
      if (!validResponse) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Explain response validation failed", {
          source: "api.explain",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          errors: formatAjvErrors(validateExplainResponse.errors),
        }));
      }

      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json(buildApiError("INTERNAL_ERROR", "Explain endpoint failed", {
        source: "api.explain",
        request_id: identity.request_id,
        trace_id: identity.trace_id,
        reason: error instanceof Error ? error.message : "unknown_error",
      }));
    }
  });

  app.post("/profile", async (req, res) => {
    const identity = createIdentity("profile");

    try {
      const body = req && req.body;
      const validRequest = validateProfileRequest(body);
      if (!validRequest) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "Profile request validation failed", {
          source: "api.profile",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
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
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Profile response validation failed", {
          source: "api.profile",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          errors: aiValidation.errors || [],
        }));
      }

      const responsePayload = {
        request_id: identity.request_id,
        trace_id: identity.trace_id,
        ...result,
      };

      const schemaValidation = validateProfileResponse(responsePayload);
      if (!schemaValidation) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Profile envelope validation failed", {
          source: "api.profile",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          errors: formatAjvErrors(validateProfileResponse.errors),
        }));
      }

      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json(buildApiError("INTERNAL_ERROR", "Profile endpoint failed", {
        source: "api.profile",
        request_id: identity.request_id,
        trace_id: identity.trace_id,
        reason: error instanceof Error ? error.message : "unknown_error",
      }));
    }
  });
}

module.exports = {
  registerAssistantRoutes,
};
