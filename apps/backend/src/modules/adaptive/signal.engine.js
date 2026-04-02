const { normalizeWeights } = require("./weight.utils");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function toSignalVector(features) {
  const safeFeatures = toSafeObject(features);

  return {
    nutrition: clamp01(toSafeNumber(safeFeatures.nutrition_score, 0.5)),
    dosha: clamp01(toSafeNumber(safeFeatures.dosha_score, 0.5)),
    digestibility: clamp01(toSafeNumber(safeFeatures.digestibility_score, 0.5)),
    familiarity: clamp01(toSafeNumber(safeFeatures.familiarity_score, 0.5)),
  };
}

function invertSignal(signal) {
  return {
    nutrition: 1 - signal.nutrition,
    dosha: 1 - signal.dosha,
    digestibility: 1 - signal.digestibility,
    familiarity: 1 - signal.familiarity,
  };
}

function weakenSignal(signal, factor = 0.2) {
  return {
    nutrition: (signal.nutrition * factor) + (0.5 * (1 - factor)),
    dosha: (signal.dosha * factor) + (0.5 * (1 - factor)),
    digestibility: (signal.digestibility * factor) + (0.5 * (1 - factor)),
    familiarity: (signal.familiarity * factor) + (0.5 * (1 - factor)),
  };
}

function deriveSignalFromFeedback(feedback, mealFeatures) {
  const mode = typeof feedback === "string" ? feedback.trim().toUpperCase() : "";
  const signal = toSignalVector(mealFeatures);

  if (mode === "LIKE") {
    return normalizeWeights(signal);
  }

  if (mode === "DISLIKE") {
    return normalizeWeights(invertSignal(signal));
  }

  if (mode === "SKIP") {
    return normalizeWeights(weakenSignal(signal));
  }

  return normalizeWeights(signal);
}

module.exports = {
  deriveSignalFromFeedback,
};
