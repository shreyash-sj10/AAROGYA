const symptomMap = {
  acidity: ["high_pitta"],
  bloating: ["high_vata"],
  fatigue: ["low_agni"],
  constipation: ["high_vata"],
  heaviness: ["high_kapha"],
};

function toSafeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function normalizeInterpretation(result, fallbackSymptomTags) {
  const safeResult = result && typeof result === "object" ? result : {};
  const normalizedSymptomTags = toSafeStringArray(
    Array.isArray(safeResult.symptom_tags) && safeResult.symptom_tags.length > 0
      ? safeResult.symptom_tags
      : fallbackSymptomTags
  );

  return {
    symptom_tags: uniqueValues(normalizedSymptomTags),
    risk_flags: uniqueValues(toSafeStringArray(safeResult.risk_flags)),
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
  const normalizedSymptoms = uniqueValues(toSafeStringArray(symptoms));

  try {
    return callMLService(normalizedSymptoms, options);
  } catch (error) {
    return buildFallbackInterpretation(normalizedSymptoms);
  }
}

module.exports = {
  interpretSymptoms,
  symptomMap,
};
