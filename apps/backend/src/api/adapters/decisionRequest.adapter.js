const { getFoods, getFoodsSource, refreshFoodsFromDb } = require("../../repositories/food.repository");
const { getRules, getRulesSource, refreshRulesFromDb } = require("../../repositories/rule.repository");
const { getTemplates, getTemplatesSource, refreshTemplatesFromDb } = require("../../repositories/template.repository");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRequiredNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid required field: ${fieldName}`);
  }
  return value;
}

function normalizeDosha(value) {
  const safe = toSafeObject(value);
  const vata = assertRequiredNumber(safe.vata, "dosha_estimate.vata");
  const pitta = assertRequiredNumber(safe.pitta, "dosha_estimate.pitta");
  const kapha = assertRequiredNumber(safe.kapha, "dosha_estimate.kapha");
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    throw new Error("Invalid dosha_estimate: sum must be greater than 0");
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));
  return { vata: nv, pitta: np, kapha: Number((1 - nv - np).toFixed(6)) };
}

function assertRequiredString(value, fieldName) {
  const normalized = toSafeString(value);
  if (!normalized) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return normalized;
}

function buildUserState(userState, constraints, userHistory) {
  const safeUserState = toSafeObject(userState);
  const safeContext = toSafeObject(safeUserState.context);
  const safeConstraints = toSafeObject(constraints);
  const safeUserHistory = Array.isArray(userHistory) ? userHistory : toSafeObject(userHistory);

  const dietType = assertRequiredString(safeConstraints.diet_type, "diet_type");
  const mealType = assertRequiredString(safeContext.meal_type, "meal_type");
  const season = assertRequiredString(safeContext.season, "season");

  return {
    user_id: assertRequiredString(safeUserState.user_id, "user_id"),
    goals: toSafeArray(safeUserState.goals).map((item) => String(item)).filter(Boolean),
    risk_flags: toSafeArray(safeUserState.risk_flags).map((item) => String(item)).filter(Boolean),
    symptoms: toSafeArray(safeUserState.symptoms).map((item) => String(item)).filter(Boolean),
    dosha_estimate: normalizeDosha(safeUserState.dosha_estimate),
    allergies: toSafeArray(safeUserState.allergies).map((item) => String(item)).filter(Boolean),
    preferences: toSafeArray(safeUserState.preferences).map((item) => String(item)).filter(Boolean),
    diet_type: dietType,
    user_history: clone(safeUserHistory),
    context: {
      meal_type: mealType,
      season,
    },
  };
}

function adaptDecisionRequest(decisionRequest, options = {}) {
  const safeRequest = toSafeObject(decisionRequest);
  const safeOptions = toSafeObject(options);
  const userState = buildUserState(safeRequest.user_state, safeRequest.constraints, safeRequest.user_history);

  void refreshFoodsFromDb().catch((error) => {
    console.warn(`[DATA SOURCE] foods: fallback (DB failure: ${error instanceof Error ? error.message : "unknown"})`);
  });
  void refreshRulesFromDb().catch((error) => {
    console.warn(`[DATA SOURCE] rules: fallback (DB failure: ${error instanceof Error ? error.message : "unknown"})`);
  });
  void refreshTemplatesFromDb().catch((error) => {
    console.warn(`[DATA SOURCE] templates: fallback (DB failure: ${error instanceof Error ? error.message : "unknown"})`);
  });

  const repoFoods = getFoods();
  const repoRules = getRules();
  const repoTemplates = getTemplates();
  const foods = toSafeArray(safeOptions.foodsOverride).length > 0
    ? toSafeArray(safeOptions.foodsOverride)
    : repoFoods;
  const rules = toSafeArray(safeOptions.rulesOverride).length > 0
    ? toSafeArray(safeOptions.rulesOverride)
    : repoRules;

  console.info(`[DATA SOURCE] foods: ${toSafeArray(safeOptions.foodsOverride).length > 0 ? "override" : getFoodsSource()}`);
  console.info(`[DATA SOURCE] rules: ${toSafeArray(safeOptions.rulesOverride).length > 0 ? "override" : getRulesSource()}`);
  console.info(`[DATA SOURCE] templates: ${getTemplatesSource()}`);

  const constraints = toSafeObject(safeRequest.constraints);
  const context = toSafeObject(userState.context);

  return {
    request_id: assertRequiredString(safeRequest.request_id, "request_id"),
    trace_id: assertRequiredString(safeRequest.trace_id, "trace_id"),
    mealType: assertRequiredString(context.meal_type, "meal_type"),
    userState,
    constraints: clone(constraints),
    preferences: toSafeArray(userState.preferences),
    context: clone(context),
    foods: clone(foods),
    rules: clone(rules),
    rules_version: toSafeString(toSafeObject(safeRequest.meta).rules_version),
    meta: clone(toSafeObject(safeRequest.meta)),
    userHistory: clone(toSafeArray(safeRequest.user_history)),
    templates: clone(repoTemplates),
  };
}

module.exports = {
  adaptDecisionRequest,
};



