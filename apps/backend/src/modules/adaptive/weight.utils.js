const ADAPTIVE_CONFIG = require("../../config/adaptive");

const WEIGHT_KEYS = ["nutrition", "dosha", "digestibility", "familiarity"];

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWeights(weights) {
  const safeWeights = weights && typeof weights === "object" ? weights : {};
  const min = toSafeNumber(ADAPTIVE_CONFIG.bounds.min, 0.1);
  const max = toSafeNumber(ADAPTIVE_CONFIG.bounds.max, 0.6);
  const normalized = {};

  WEIGHT_KEYS.forEach((key) => {
    normalized[key] = clamp(toSafeNumber(safeWeights[key], ADAPTIVE_CONFIG.defaultWeights[key]), min, max);
  });

  for (let i = 0; i < 12; i += 1) {
    const sum = WEIGHT_KEYS.reduce((acc, key) => acc + normalized[key], 0);
    const safeSum = sum > 0 ? sum : 1;

    WEIGHT_KEYS.forEach((key) => {
      normalized[key] = normalized[key] / safeSum;
    });

    const below = WEIGHT_KEYS.filter((key) => normalized[key] < min);
    const above = WEIGHT_KEYS.filter((key) => normalized[key] > max);

    if (below.length === 0 && above.length === 0) {
      break;
    }

    const fixed = new Set([...below, ...above]);
    below.forEach((key) => {
      normalized[key] = min;
    });
    above.forEach((key) => {
      normalized[key] = max;
    });

    const free = WEIGHT_KEYS.filter((key) => !fixed.has(key));
    const fixedSum = WEIGHT_KEYS.reduce((acc, key) => acc + (fixed.has(key) ? normalized[key] : 0), 0);
    const remaining = Math.max(0, 1 - fixedSum);

    if (free.length === 0) {
      break;
    }

    const freeSum = free.reduce((acc, key) => acc + normalized[key], 0);

    if (freeSum <= 0) {
      const even = remaining / free.length;
      free.forEach((key) => {
        normalized[key] = even;
      });
    } else {
      free.forEach((key) => {
        normalized[key] = (normalized[key] / freeSum) * remaining;
      });
    }
  }

  let finalSum = WEIGHT_KEYS.reduce((acc, key) => acc + normalized[key], 0);
  if (finalSum <= 0) {
    WEIGHT_KEYS.forEach((key) => {
      normalized[key] = ADAPTIVE_CONFIG.defaultWeights[key];
    });
    finalSum = 1;
  }

  WEIGHT_KEYS.forEach((key) => {
    normalized[key] = clamp(normalized[key] / finalSum, min, max);
  });

  const drift = 1 - WEIGHT_KEYS.reduce((acc, key) => acc + normalized[key], 0);
  const tailKey = WEIGHT_KEYS[WEIGHT_KEYS.length - 1];
  normalized[tailKey] = clamp(normalized[tailKey] + drift, min, max);

  const rescale = WEIGHT_KEYS.reduce((acc, key) => acc + normalized[key], 0) || 1;
  WEIGHT_KEYS.forEach((key) => {
    normalized[key] = Number((normalized[key] / rescale).toFixed(6));
  });

  return normalized;
}

module.exports = {
  WEIGHT_KEYS,
  normalizeWeights,
};
