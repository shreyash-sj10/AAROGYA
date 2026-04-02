const ADAPTIVE_CONFIG = require("../../config/adaptive");
const { WEIGHT_KEYS, normalizeWeights } = require("./weight.utils");

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function updateWeights(oldWeights, signal, alpha) {
  const safeOld = normalizeWeights(oldWeights);
  const safeSignal = normalizeWeights(signal);
  const safeAlpha = Math.min(1, Math.max(0, toSafeNumber(alpha, ADAPTIVE_CONFIG.alpha)));
  const updated = {};

  WEIGHT_KEYS.forEach((key) => {
    updated[key] = ((1 - safeAlpha) * safeOld[key]) + (safeAlpha * safeSignal[key]);
  });

  return normalizeWeights(updated);
}

module.exports = {
  updateWeights,
};
