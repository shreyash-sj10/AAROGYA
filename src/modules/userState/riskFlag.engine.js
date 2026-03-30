function includesValue(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function computeRiskFlags(userState) {
  const safeUserState = userState && typeof userState === "object" ? userState : {};
  const prakriti = safeUserState.prakriti && typeof safeUserState.prakriti === "object" ? safeUserState.prakriti : {};
  const symptomTags = Array.isArray(safeUserState.symptom_tags) ? [...safeUserState.symptom_tags] : [];
  const conditions = Array.isArray(safeUserState.conditions) ? [...safeUserState.conditions] : [];
  const existingRiskFlags = Array.isArray(safeUserState.risk_flags) ? [...safeUserState.risk_flags] : [];
  const agniStrength = toSafeNumber(safeUserState.agni_strength, 0.5);

  const flags = new Set(existingRiskFlags);

  if (toSafeNumber(prakriti.pitta, 0) > 0.6 || includesValue(symptomTags, "acidity")) {
    flags.add("high_pitta");
  }

  if (toSafeNumber(prakriti.vata, 0) > 0.6) {
    flags.add("high_vata");
  }

  if (toSafeNumber(prakriti.kapha, 0) > 0.6) {
    flags.add("high_kapha");
  }

  if (includesValue(conditions, "diabetes") || includesValue(conditions, "pcos")) {
    flags.add("high_gi_sensitive");
  }

  if (agniStrength < 0.4) {
    flags.add("digestion_weak");
  }

  if (agniStrength < 0.5) {
    flags.add("avoid_heavy_food");
  }

  return Array.from(flags);
}

module.exports = {
  computeRiskFlags,
};
