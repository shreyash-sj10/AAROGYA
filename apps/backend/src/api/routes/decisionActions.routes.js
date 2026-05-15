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

const constraintsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["max_calories", "diet_type"],
  properties: {
    max_calories: { type: "number", minimum: 0 },
    diet_type: { type: "string", minLength: 1 },
  },
};

const replaceFoodRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "meal_id", "food_item", "constraints", "context", "meal_type", "season"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
    meal_id: { type: "string", minLength: 1 },
    food_item: { type: "string", minLength: 1 },
    meal_type: { type: "string", minLength: 1 },
    season: { type: "string", minLength: 1 },
    constraints: constraintsSchema,
    context: commonContextSchema,
  },
};

const regenerateMealRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "meal_id", "context", "meal_type", "season", "constraints"],
  properties: {
    request_id: { type: "string", minLength: 1 },
    trace_id: { type: "string", minLength: 1 },
    meal_id: { type: "string", minLength: 1 },
    meal_type: { type: "string", minLength: 1 },
    season: { type: "string", minLength: 1 },
    constraints: constraintsSchema,
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

function requireString(value, fieldName) {
  const normalized = toSafeString(value, "");
  if (!normalized) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return normalized;
}

function requireNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value;
}

function toDecisionRequest(actionBody, actionType) {
  const safeBody = toSafeObject(actionBody);
  const safeContext = toSafeObject(safeBody.context);
  const safePrakriti = toSafeObject(safeContext.prakriti);
  const safeConstraints = toSafeObject(safeBody.constraints);

  const requestId = requireString(safeBody.request_id, "request_id");
  const traceId = toSafeString(safeBody.trace_id, `${requestId}_trace`);
  const mealType = requireString(safeBody.meal_type, "meal_type");
  const season = requireString(safeBody.season, "season");
  const maxCalories = requireNumber(safeConstraints.max_calories, "constraints.max_calories");
  const dietType = requireString(safeConstraints.diet_type, "constraints.diet_type");

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
        vata: requireNumber(safePrakriti.vata, "context.prakriti.vata"),
        pitta: requireNumber(safePrakriti.pitta, "context.prakriti.pitta"),
        kapha: requireNumber(safePrakriti.kapha, "context.prakriti.kapha"),
      },
      allergies: [],
      preferences: [],
      context: {
        meal_type: mealType,
        season,
      },
    },
    constraints: {
      max_calories: maxCalories,
      diet_type: dietType,
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
    const reason = error instanceof Error ? error.message : "unknown_error";

    if (reason.startsWith("Missing required field:")) {
      return res.status(400).json(buildApiError("VALIDATION_ERROR", reason, req && req.body, {
        source: `api.${actionType}`,
      }));
    }

    return res.status(500).json(buildApiError("INTERNAL_ERROR", "Decision action failed", req && req.body, {
      source: `api.${actionType}`,
      reason,
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
