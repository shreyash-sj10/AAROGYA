const crypto = require("crypto");
const cacheRepository = require("./cache.repository");
const { recordError } = require("../../observability/metrics");

const TTL = {
  recipe: 60 * 60,
  candidates: 15 * 60,
  rag: 60,
};

function logCacheError(operation, key, error, extra = {}) {
  const details = error instanceof Error ? error.message : String(error || "unknown");
  console.error(JSON.stringify({
    level: "error",
    event: "cache_service_failure",
    operation,
    key,
    error: details,
    ...extra,
  }));
}

function metricError(type) {
  recordError(type === "parse" ? "CACHE_PARSE_ERROR" : "CACHE_ERROR");
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureKey(key, operation) {
  const safeKey = typeof key === "string" ? key.trim() : "";
  if (!safeKey) {
    const error = new Error("key is required");
    logCacheError(operation, safeKey, error, { reason: "invalid_key" });
    metricError("cache");
    throw new Error("Cache failure: key is required");
  }

  return safeKey;
}

function normalizeFoodId(food) {
  const safeFood = toSafeObject(food);
  return toSafeString(safeFood.id || safeFood.recipe_id || safeFood.name);
}

function normalizeRuleId(rule) {
  const safeRule = toSafeObject(rule);
  return toSafeString(safeRule.id || safeRule.rule_id || safeRule.name);
}

function normalizeGoalVector(userProfile) {
  const safeProfile = toSafeObject(userProfile);
  const safeGoals = toSafeObject(safeProfile.goal_vector || safeProfile.goals || {});

  const keys = Object.keys(safeGoals).sort();
  return keys.reduce((acc, key) => {
    const value = safeGoals[key];
    acc[key] = typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : value;
    return acc;
  }, {});
}

function stableUserProfile(userProfile) {
  const safeProfile = toSafeObject(userProfile);

  return {
    risk_flags: toSafeArray(safeProfile.risk_flags)
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .sort(),
    allergies: toSafeArray(safeProfile.allergies)
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .sort(),
    diet_type: toSafeString(safeProfile.diet_type || safeProfile.diet),
    dosha_estimate: toSafeObject(safeProfile.dosha_estimate),
    goal_vector: normalizeGoalVector(safeProfile),
  };
}

function generateCacheKey(input = {}) {
  const safeInput = toSafeObject(input);
  const foods = toSafeArray(safeInput.foods).map(normalizeFoodId).filter(Boolean).sort();
  const rules = toSafeArray(safeInput.rules).map(normalizeRuleId).filter(Boolean).sort();
  const templateId = toSafeString(safeInput.template_id || safeInput.templateId || safeInput.mealType);
  const rulesVersion = toSafeString(safeInput.rulesVersion || safeInput.rules_version);
  const payload = {
    user_state: stableUserProfile(safeInput.userState || safeInput.userProfile),
    template_id: templateId,
    rules_version: rulesVersion || "unversioned",
    foods,
    rules,
  };

  const hash = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  return `cache:${hash}`;
}

function resolveTtlByKey(key, ttlSeconds) {
  if (typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    return Math.floor(ttlSeconds);
  }

  if (typeof key === "string") {
    if (key.startsWith("recipe:")) {
      return TTL.recipe;
    }

    if (key.startsWith("candidates:")) {
      return TTL.candidates;
    }

    if (key.startsWith("rag:")) {
      return TTL.rag;
    }
  }

  return 300;
}

function get(key, options = {}) {
  const safeKey = ensureKey(key, "get");
  const optional = Boolean(options && options.optional === true);

  try {
    return cacheRepository.getSync(safeKey);
  } catch (error) {
    logCacheError("get", safeKey, error);
    metricError("cache");
    if (optional) {
      return null;
    }
    throw new Error("Cache failure");
  }
}

function set(key, value, ttlSeconds) {
  const safeKey = ensureKey(key, "set");

  try {
    const ttl = resolveTtlByKey(safeKey, ttlSeconds);
    return cacheRepository.setSync(safeKey, value, ttl);
  } catch (error) {
    logCacheError("set", safeKey, error);
    metricError("cache");
    throw new Error("Cache failure");
  }
}

function del(key) {
  const safeKey = ensureKey(key, "delete");

  return cacheRepository.delete(safeKey).catch((error) => {
    logCacheError("delete", safeKey, error);
    metricError("cache");
    throw new Error("Cache failure");
  });
}

module.exports = {
  get,
  set,
  delete: del,
  generateCacheKey,
};
