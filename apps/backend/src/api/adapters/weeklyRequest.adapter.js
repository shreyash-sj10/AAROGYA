const { getFoods } = require("../../repositories/food.repository");
const { getRules } = require("../../repositories/rule.repository");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDosha(value) {
  const safe = toSafeObject(value);
  const vata = Math.max(0, toSafeNumber(safe.vata, 0.333333));
  const pitta = Math.max(0, toSafeNumber(safe.pitta, 0.333333));
  const kapha = Math.max(0, toSafeNumber(safe.kapha, 0.333334));
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return { vata: 0.333333, pitta: 0.333333, kapha: 0.333334 };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));
  return { vata: nv, pitta: np, kapha: Number((1 - nv - np).toFixed(6)) };
}

function normalizeDayCount(value) {
  const parsed = Math.trunc(toSafeNumber(value, 7));
  return Math.max(1, Math.min(7, parsed));
}

function adaptWeeklyDecisionRequest(payload) {
  const safe = toSafeObject(payload);
  const safeMeta = toSafeObject(safe.meta);
  const safeContext = toSafeObject(safe.week_context);
  const safeConstraints = toSafeObject(safe.constraints);

  const hydratedFoods = getFoods();
  const hydratedRules = getRules();

  return {
    request_id: toSafeString(safeMeta.request_id, `weekly_${toSafeString(safe.user_id, "anonymous")}`),
    trace_id: toSafeString(safeMeta.trace_id, `weekly_trace_${toSafeString(safe.user_id, "anonymous")}`),
    userState: {
      user_id: toSafeString(safe.user_id, "anonymous"),
      goals: toSafeArray(safe.goals).map((item) => String(item)).filter(Boolean),
      risk_flags: toSafeArray(safe.risk_flags).map((item) => String(item)).filter(Boolean),
      symptoms: toSafeArray(safe.symptoms).map((item) => String(item)).filter(Boolean),
      dosha_estimate: normalizeDosha(safe.dosha_profile),
      allergies: toSafeArray(safe.allergies).map((item) => String(item)).filter(Boolean),
      preferences: toSafeArray(safe.preferences).map((item) => String(item)).filter(Boolean),
      context: {
        meal_type: "lunch",
        season: toSafeString(safeConstraints.season, "summer"),
      },
    },
    constraints: {
      max_calories: Math.max(0, toSafeNumber(safeConstraints.max_calories, 0)),
      diet_type: toSafeString(safeConstraints.diet_type, "vegetarian"),
    },
    week_context: {
      days: normalizeDayCount(safeContext.days),
      start_date: toSafeString(safeContext.start_date, "2026-01-01"),
    },
    meta: {
      timestamp: Math.max(0, Math.trunc(toSafeNumber(safeMeta.timestamp, 0))),
      request_source: toSafeString(safeMeta.request_source, "weekly_api"),
      cache_allowed: Boolean(safeMeta.cache_allowed),
    },
    dependency_manifest: {
      foods_count: hydratedFoods.length,
      rules_count: hydratedRules.length,
    },
    userHistory: clone(toSafeArray(safe.user_history)),
    weeklyState: {
      past_meals: [],
      category_counts: {},
      diversity_memory: [],
    },
    _internal_hydrated: {
      foods: clone(hydratedFoods),
      rules: clone(hydratedRules),
    },
  };
}

module.exports = {
  adaptWeeklyDecisionRequest,
};
