const { loadAllFoods } = require("../../modules/food");
const defaultRules = require("../../rules/engine/rule.samples");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDosha(value) {
  const safe = toSafeObject(value);
  const vata = typeof safe.vata === "number" && Number.isFinite(safe.vata) ? safe.vata : 0.333333;
  const pitta = typeof safe.pitta === "number" && Number.isFinite(safe.pitta) ? safe.pitta : 0.333333;
  const kapha = typeof safe.kapha === "number" && Number.isFinite(safe.kapha) ? safe.kapha : 0.333334;
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return { vata: 0.333333, pitta: 0.333333, kapha: 0.333334 };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));
  return { vata: nv, pitta: np, kapha: Number((1 - nv - np).toFixed(6)) };
}

function buildUserState(userState, constraints) {
  const safeUserState = toSafeObject(userState);
  const safeContext = toSafeObject(safeUserState.context);
  const safeConstraints = toSafeObject(constraints);

  return {
    user_id: toSafeString(safeUserState.user_id, "anonymous"),
    goals: toSafeArray(safeUserState.goals).map((item) => String(item)).filter(Boolean),
    risk_flags: toSafeArray(safeUserState.risk_flags).map((item) => String(item)).filter(Boolean),
    symptoms: toSafeArray(safeUserState.symptoms).map((item) => String(item)).filter(Boolean),
    dosha_estimate: normalizeDosha(safeUserState.dosha_estimate),
    allergies: toSafeArray(safeUserState.allergies).map((item) => String(item)).filter(Boolean),
    preferences: toSafeArray(safeUserState.preferences).map((item) => String(item)).filter(Boolean),
    diet_type: toSafeString(safeConstraints.diet_type, "vegetarian"),
    context: {
      meal_type: toSafeString(safeContext.meal_type, "lunch"),
      season: toSafeString(safeContext.season, "summer"),
    },
  };
}

function adaptDecisionRequest(decisionRequest, options = {}) {
  const safeRequest = toSafeObject(decisionRequest);
  const safeOptions = toSafeObject(options);
  const userState = buildUserState(safeRequest.user_state, safeRequest.constraints);
  const foods = toSafeArray(safeOptions.foodsOverride).length > 0
    ? toSafeArray(safeOptions.foodsOverride)
    : loadAllFoods();
  const rules = toSafeArray(safeOptions.rulesOverride).length > 0
    ? toSafeArray(safeOptions.rulesOverride)
    : defaultRules;
  const constraints = toSafeObject(safeRequest.constraints);
  const context = toSafeObject(userState.context);

  return {
    request_id: toSafeString(safeRequest.request_id, "orchestrator_request"),
    trace_id: toSafeString(safeRequest.trace_id, "orchestrator_trace"),
    mealType: toSafeString(context.meal_type, "lunch"),
    userState,
    constraints: clone(constraints),
    preferences: toSafeArray(userState.preferences),
    context: clone(context),
    foods: clone(foods),
    rules: clone(rules),
    rules_version: toSafeString(toSafeObject(safeRequest.meta).rules_version, "rules_v1"),
    meta: clone(toSafeObject(safeRequest.meta)),
    userHistory: {},
  };
}

module.exports = {
  adaptDecisionRequest,
};

