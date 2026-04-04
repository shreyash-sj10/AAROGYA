const Ajv = require("ajv");
const { adaptDecisionRequest } = require("../adapters/decisionRequest.adapter");
const { generateMealPlan } = require("../../core/pipeline/orchestrator");
const { validateDecisionRequest } = require("../../contracts/validators/validateDecisionRequest");
const { validateDecisionResponse } = require("../../contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../../contracts/validators/validateTrace");
const { buildErrorResponse } = require("../../contracts/errorBuilder");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });

const commonContextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["goal", "prakriti", "conditions"],
  properties: {
    goal: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
    prakriti: {
      type: "object",
      additionalProperties: false,
      required: ["vata", "pitta", "kapha"],
      properties: {
        vata: { type: "number", minimum: 0, maximum: 1 },
        pitta: { type: "number", minimum: 0, maximum: 1 },
        kapha: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    conditions: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
};

const replaceFoodRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "meal_id", "food_item", "constraints", "context"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
    meal_id: { type: "string", minLength: 1 },
    food_item: { type: "string", minLength: 1 },
    meal_type: { type: "string" },
    season: { type: "string" },
    constraints: {
      type: "object",
      additionalProperties: false,
      required: ["max_calories", "diet_type"],
      properties: {
        max_calories: { type: "number", minimum: 0 },
        diet_type: { type: "string", minLength: 1 },
      },
    },
    context: commonContextSchema,
  },
};

const regenerateMealRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "meal_id", "context"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
    meal_id: { type: "string", minLength: 1 },
    meal_type: { type: "string" },
    season: { type: "string" },
    context: commonContextSchema,
  },
};

const validateReplaceFoodRequest = ajv.compile(replaceFoodRequestSchema);
const validateRegenerateMealRequest = ajv.compile(regenerateMealRequestSchema);

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
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

function buildApiError(code, message, body, details = {}) {
  const safeBody = toSafeObject(body);
  const safeDetails = toSafeObject(details);

  return buildErrorResponse({
    code,
    message,
    request_id: toSafeString(safeDetails.request_id || safeBody.request_id, "unknown_request"),
    trace_id: toSafeString(safeDetails.trace_id || safeBody.trace_id, "unknown_trace"),
    details: safeDetails,
  });
}

function toDecisionRequest(actionBody, actionType) {
  const safeBody = toSafeObject(actionBody);
  const safeContext = toSafeObject(safeBody.context);
  const safePrakriti = toSafeObject(safeContext.prakriti);
  const safeConstraints = toSafeObject(safeBody.constraints);

  const requestId = toSafeString(safeBody.request_id, `${actionType}_request`);
  const traceId = toSafeString(safeBody.trace_id, `${requestId}_trace`);

  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: requestId,
    trace_id: traceId,
    user_state: {
      user_id: "anonymous",
      goals: toSafeString(safeContext.goal) ? [toSafeString(safeContext.goal)] : [],
      risk_flags: [],
      symptoms: toSafeArray(safeContext.conditions).map((item) => String(item)).filter(Boolean),
      dosha_estimate: {
        vata: typeof safePrakriti.vata === "number" ? safePrakriti.vata : 0.34,
        pitta: typeof safePrakriti.pitta === "number" ? safePrakriti.pitta : 0.33,
        kapha: typeof safePrakriti.kapha === "number" ? safePrakriti.kapha : 0.33,
      },
      allergies: [],
      preferences: [],
      context: {
        meal_type: toSafeString(safeBody.meal_type, "lunch"),
        season: toSafeString(safeBody.season, "summer"),
      },
    },
    constraints: {
      max_calories: typeof safeConstraints.max_calories === "number" ? safeConstraints.max_calories : 700,
      diet_type: toSafeString(safeConstraints.diet_type, "vegetarian"),
    },
    meta: {
      timestamp: Date.now(),
      request_source: `decision_action_${actionType}`,
      cache_allowed: true,
    },
  };
}

async function runAction(req, res, actionType, validateFn, validationErrors) {
  try {
    const body = req && req.body;
    const valid = validateFn(body);
    if (!valid) {
      return res.status(400).json(buildApiError("VALIDATION_ERROR", validationErrors, body, {
        source: `api.${actionType}`,
        errors: formatAjvErrors(validateFn.errors),
      }));
    }

    const decisionRequest = toDecisionRequest(body, actionType);
    const reqValidation = validateDecisionRequest(decisionRequest);
    if (!reqValidation.valid) {
      return res.status(400).json(buildApiError("VALIDATION_ERROR", "DecisionRequest_v1 validation failed", body, {
        source: `api.${actionType}`,
        errors: reqValidation.errors || [],
      }));
    }

    const internal = adaptDecisionRequest(decisionRequest);
    const result = await generateMealPlan(internal);

    const responseValidation = validateDecisionResponse(result);
    if (!responseValidation.valid) {
      return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "DecisionResponse_v1 validation failed", body, {
        source: `api.${actionType}`,
        errors: responseValidation.errors || [],
      }));
    }

    const traceValidation = validateTrace(result.trace);
    if (!traceValidation.valid) {
      return res.status(500).json(buildApiError("TRACE_VALIDATION_ERROR", "Trace_v1 validation failed", body, {
        source: `api.${actionType}`,
        errors: traceValidation.errors || [],
      }));
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json(buildApiError("INTERNAL_ERROR", "Decision action failed", req && req.body, {
      source: `api.${actionType}`,
      reason: error instanceof Error ? error.message : "unknown_error",
    }));
  }
}

function registerDecisionActionRoutes(app) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerDecisionActionRoutes requires an app with post(path, ...handlers)");
  }

  app.post("/replace-food", async (req, res) => runAction(req, res, "replace_food", validateReplaceFoodRequest, "Replace food request validation failed"));
  app.post("/regenerate-meal", async (req, res) => runAction(req, res, "regenerate_meal", validateRegenerateMealRequest, "Regenerate meal request validation failed"));
}

module.exports = {
  registerDecisionActionRoutes,
};
