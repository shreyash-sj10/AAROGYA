const { parseSymptoms } = require("../services/ml/mlClient");

const FALLBACK_SYMPTOM_MAP = {
  acidity: ["high_pitta"],
  bloating: ["digestion_weak"],
  burning: ["high_pitta"],
  gas: ["digestion_weak"],
};

const FLAG_NORMALIZATION_MAP = {
  low_agni: "digestion_weak",
};

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeFlags(flags) {
  return Array.from(new Set(
    toSafeArray(flags)
      .map((flag) => FLAG_NORMALIZATION_MAP[normalizeString(flag)] || normalizeString(flag))
      .filter(Boolean)
  ));
}

function extractFallbackFlags(text) {
  const normalizedText = normalizeString(text);

  if (!normalizedText) {
    return [];
  }

  return Object.keys(FALLBACK_SYMPTOM_MAP).reduce((flags, symptom) => {
    if (normalizedText.includes(symptom)) {
      return flags.concat(FALLBACK_SYMPTOM_MAP[symptom]);
    }

    return flags;
  }, []);
}

async function buildUserState(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const sanitizedText = normalizeString(safeInput.text);
  const mlResult = await parseSymptoms(sanitizedText);
  const mlFlags = mlResult && Array.isArray(mlResult.symptom_tags) && mlResult.symptom_tags.length > 0
    ? mlResult.symptom_tags
    : null;
  const fallbackUsed = mlFlags === null;
  const rawFlags = fallbackUsed ? extractFallbackFlags(sanitizedText) : mlFlags;
  const normalizedFlags = normalizeFlags(rawFlags);

  return {
    ...safeInput,
    text: sanitizedText,
    risk_flags: normalizedFlags,
    meta: {
      mlUsed: !fallbackUsed,
      fallbackUsed,
    },
  };
}

module.exports = {
  buildUserState,
};
