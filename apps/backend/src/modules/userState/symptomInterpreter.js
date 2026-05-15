const { normalizeString, normalizeStringArray } = require("../../utils/normalizeInput");

const symptomMap = {
  acidity: ["high_pitta"],
  bloating: ["high_vata"],
  fatigue: ["low_agni"],
  constipation: ["high_vata"],
  heaviness: ["high_kapha"],
};

const KEYWORD_TO_FLAGS = {
  acidity: ["high_pitta"],
  burning: ["high_pitta"],
  heartburn: ["high_pitta"],
  bloating: ["high_vata", "digestion_weak"],
  gas: ["high_vata", "digestion_weak"],
  constipation: ["high_vata"],
  heaviness: ["high_kapha"],
  sluggish: ["high_kapha"],
  fatigue: ["digestion_weak"],
};

// Removed toSafeStringArray - now using normalizeStringArray from normalizeInput.js

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function normalizeInterpretation(result, fallbackSymptomTags) {
  const safeResult = result && typeof result === "object" ? result : {};
  const normalizedSymptomTags = normalizeStringArray(
    Array.isArray(safeResult.symptom_tags) && safeResult.symptom_tags.length > 0
      ? safeResult.symptom_tags
      : fallbackSymptomTags
  );

  return {
    symptom_tags: uniqueValues(normalizedSymptomTags),
    risk_flags: uniqueValues(normalizeStringArray(safeResult.risk_flags)),
  };
}

function callMLService(symptoms, options) {
  const safeOptions = options && typeof options === "object" ? options : {};

  if (safeOptions.ml_service_response && typeof safeOptions.ml_service_response === "object") {
    return normalizeInterpretation(safeOptions.ml_service_response, symptoms);
  }

  throw new Error("ML service unavailable.");
}

function buildFallbackInterpretation(symptoms) {
  const riskFlags = symptoms.reduce((flags, symptom) => {
    const mappedFlags = symptomMap[symptom] || [];
    return flags.concat(mappedFlags);
  }, []);

  return {
    symptom_tags: uniqueValues(symptoms),
    risk_flags: uniqueValues(riskFlags),
  };
}

function interpretSymptoms(symptoms, options) {
  const normalizedSymptoms = uniqueValues(normalizeStringArray(symptoms));

  try {
    return callMLService(normalizedSymptoms, options);
  } catch (error) {
    return buildFallbackInterpretation(normalizedSymptoms);
  }
}

// Removed toSafeString - now using normalizeString from normalizeInput.js

function parseUserInputDeterministic(input) {
  const text = normalizeString(input);

  const riskFlags = Object.keys(KEYWORD_TO_FLAGS).reduce((acc, keyword) => {
    if (text.includes(keyword)) {
      return acc.concat(KEYWORD_TO_FLAGS[keyword]);
    }

    return acc;
  }, []);

  return {
    risk_flags: uniqueValues(riskFlags),
    dosha_estimate: {
      vata: 0.34,
      pitta: 0.33,
      kapha: 0.33,
    },
    confidence: 0.5,
  };
}

module.exports = {
  interpretSymptoms,
  parseUserInputDeterministic,
  symptomMap,
};
