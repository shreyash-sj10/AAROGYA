const ADAPTIVE_CONFIG = require("../../config/adaptive");
const { normalizeWeights } = require("./weight.utils");
const preferenceRepository = require("../../repositories/preference.repository");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

// Cache-only map. DB repository is source of truth.
const preferenceCache = new Map();
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.AAROGYA_ADAPTIVE_CACHE_TTL_MS || 300000));

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

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultWeights() {
  return normalizeWeights(ADAPTIVE_CONFIG.defaultWeights);
}

function setCache(userId, weights) {
  preferenceCache.set(userId, {
    value: clone(weights),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getCache(userId) {
  const entry = preferenceCache.get(userId);
  if (!entry || typeof entry !== "object") return null;
  if (Date.now() > Number(entry.expiresAt || 0)) {
    preferenceCache.delete(userId);
    return null;
  }
  return clone(entry.value);
}

function getCachedUserWeights(user_id) {
  const userId = toSafeString(user_id, "anonymous");
  const existing = getCache(userId);

  if (!existing || typeof existing !== "object") {
    return getDefaultWeights();
  }

  return normalizeWeights(existing);
}

async function getUserWeightsAsync(user_id) {
  const userId = toSafeString(user_id, "anonymous");

  try {
    const dbWeights = await preferenceRepository.getPreference(userId);
    if (dbWeights && typeof dbWeights === "object") {
      const normalized = normalizeWeights(dbWeights);
      setCache(userId, normalized);
      return normalized;
    }
  } catch (err) {
    logger.error("User preference DB read failed", { err });
    metrics.increment("preference_read_error");
  }

  return getCachedUserWeights(userId);
}

function saveUserWeights(user_id, weights) {
  const userId = toSafeString(user_id, "anonymous");
  const normalized = normalizeWeights(weights);

  setCache(userId, normalized);
  preferenceRepository.upsertPreference(userId, normalized).catch((err) => {
    logger.error("User preference save failed", { err });
    metrics.increment("preference_write_error");
  });

  return clone(normalized);
}

module.exports = {
  getCachedUserWeights,
  getUserWeightsAsync,
  saveUserWeights,
};
