const ADAPTIVE_CONFIG = require("../../config/adaptive");
const { normalizeWeights } = require("./weight.utils");
const preferenceRepository = require("../../repositories/preference.repository");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

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

function getUserWeights(user_id) {
  const userId = toSafeString(user_id, "anonymous");
  const existing = preferenceRepository.getPreferenceSync(userId);

  if (!existing || typeof existing !== "object") {
    return getDefaultWeights();
  }

  return normalizeWeights(existing);
}

function saveUserWeights(user_id, weights) {
  const userId = toSafeString(user_id, "anonymous");
  const normalized = normalizeWeights(weights);

  preferenceRepository.upsertPreferenceSync(userId, normalized);
  preferenceRepository.upsertPreference(userId, normalized).catch((err) => {
    logger.error("User preference save failed", { err });
    metrics.increment("preference_write_error");
  });

  return clone(normalized);
}

module.exports = {
  getUserWeights,
  saveUserWeights,
};
