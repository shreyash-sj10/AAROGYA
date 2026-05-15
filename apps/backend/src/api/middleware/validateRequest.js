const crypto = require("crypto");
const { validateDecisionRequest } = require("../../contracts/validators/validateDecisionRequest");
const { buildErrorResponse } = require("../../contracts/errorBuilder");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSimplePlanRequest(payload) {
  const safe = toSafeObject(payload);
  const calories = toPositiveNumber(safe.calories);
  const preferences = toStringArray(safe.preferences);
  const restrictions = toStringArray(safe.restrictions);

  if (!calories) {
    return null;
  }

  const mealTypeRaw = toSafeString(safe.meal_type, "lunch").toLowerCase();
  const meal_type = mealTypeRaw === "breakfast" || mealTypeRaw === "lunch" || mealTypeRaw === "dinner"
    ? mealTypeRaw
    : "lunch";

  const seasonRaw = toSafeString(safe.season, "summer").toLowerCase();
  const season = seasonRaw === "summer" || seasonRaw === "winter" || seasonRaw === "monsoon"
    ? seasonRaw
    : "summer";

  const dietRaw = toSafeString(safe.diet_type, "vegetarian").toLowerCase();
  const diet_type = dietRaw === "vegan" ? "vegan" : "vegetarian";

  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: toSafeString(safe.request_id, crypto.randomUUID()),
    trace_id: toSafeString(safe.trace_id, crypto.randomUUID()),
    user_state: {
      user_id: toSafeString(safe.user_id, "frontend_user"),
      goals: toStringArray(safe.goals).length > 0 ? toStringArray(safe.goals) : ["general_wellness"],
      risk_flags: restrictions,
      symptoms: toStringArray(safe.symptoms).length > 0 ? toStringArray(safe.symptoms) : ["general"],
      dosha_estimate: {
        vata: 0.333333,
        pitta: 0.333333,
        kapha: 0.333334,
      },
      allergies: restrictions,
      preferences,
      context: {
        meal_type,
        season,
      },
    },
    constraints: {
      max_calories: calories,
      diet_type,
    },
    meta: {
      timestamp: Date.now(),
      request_source: "frontend_simple",
      cache_allowed: true,
    },
  };
}

function validateRequest(req, res, next) {
  const originalBody = req && req.body;
  const safeBody = toSafeObject(originalBody);

  // Compatibility path: allow simplified planner payload.
  const normalizedBody = safeBody.version
    ? safeBody
    : (normalizeSimplePlanRequest(safeBody) || safeBody);

  req.body = normalizedBody;

  const validation = validateDecisionRequest(req && req.body);
  if (!validation.valid) {
    const safeValidatedBody = req && req.body && typeof req.body === "object" ? req.body : {};
    const safeMeta = safeValidatedBody.meta && typeof safeValidatedBody.meta === "object" ? safeValidatedBody.meta : {};
    return res.status(400).json(buildErrorResponse({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      request_id: safeValidatedBody.request_id || safeMeta.request_id || "unknown_request",
      trace_id: safeValidatedBody.trace_id || safeMeta.trace_id || "unknown_trace",
      details: {
        errors: Array.isArray(validation.errors) ? validation.errors : [],
      },
    }));
  }

  return next();
}

module.exports = {
  validateRequest,
};
