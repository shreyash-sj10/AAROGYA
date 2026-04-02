function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inRange01(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateAIProfile(data) {
  const safe = toSafeObject(data);
  const errors = [];

  if (safe.version !== "AIProfileOutput_v1") {
    errors.push({ message: "version must be AIProfileOutput_v1" });
  }

  if (safe.schema_version !== 1) {
    errors.push({ message: "schema_version must be 1" });
  }

  if (safe.compatibility !== "backward") {
    errors.push({ message: "compatibility must be backward" });
  }

  const riskFlags = toSafeArray(safe.risk_flags);
  if (!Array.isArray(safe.risk_flags) || riskFlags.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push({ message: "risk_flags must be string[]" });
  }

  const goals = toSafeArray(safe.goals);
  if (safe.goals !== undefined && (!Array.isArray(safe.goals) || goals.some((item) => typeof item !== "string" || !item.trim()))) {
    errors.push({ message: "goals must be string[]" });
  }

  const symptoms = toSafeArray(safe.symptoms);
  if (safe.symptoms !== undefined && (!Array.isArray(safe.symptoms) || symptoms.some((item) => typeof item !== "string" || !item.trim()))) {
    errors.push({ message: "symptoms must be string[]" });
  }

  const dosha = toSafeObject(safe.dosha_estimate);
  if (!(inRange01(toSafeNumber(dosha.vata)) && inRange01(toSafeNumber(dosha.pitta)) && inRange01(toSafeNumber(dosha.kapha)))) {
    errors.push({ message: "dosha_estimate must contain vata/pitta/kapha in [0,1]" });
  }

  if (!inRange01(toSafeNumber(safe.confidence))) {
    errors.push({ message: "confidence must be in [0,1]" });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

module.exports = {
  validateAIProfile,
};
