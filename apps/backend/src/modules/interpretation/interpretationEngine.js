const { validateMLInterpretation } = require("../../contracts/validators");
const { toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

/**
 * Merges ML interpretation with deterministic user data.
 * ML weight is capped at 0.4 as per system invariants.
 */
function mergeInterpretation(userState, mlOutput, options = {}) {
  const safeUserState = userState && typeof userState === "object" ? userState : {};
  const mlWeight = Math.min(0.4, Math.max(0, toSafeNumber(options.mlWeight, 0.3)));
  const userWeight = 1 - mlWeight;

  // 1. Validate ML Output
  const validation = validateMLInterpretation(mlOutput);
  if (!validation.valid || toSafeNumber(mlOutput.confidence, 0) <= 0) {
    return {
      userState: { ...safeUserState },
      ml_used: false,
      ml_confidence: 0,
      ml_contribution_weight: 0,
    };
  }

  const mlData = mlOutput;
  const prakritiML = mlData.prakriti_inference || {};
  const userPrakriti = safeUserState.dosha_estimate || safeUserState.prakriti || { vata: 0.33, pitta: 0.33, kapha: 0.34 };

  // 2. Weighted Merge for Prakriti (Dosha)
  const mergedPrakriti = {
    vata: Number((userWeight * toSafeNumber(userPrakriti.vata, 0.33) + mlWeight * toSafeNumber(prakritiML.vata, 0.33)).toFixed(6)),
    pitta: Number((userWeight * toSafeNumber(userPrakriti.pitta, 0.33) + mlWeight * toSafeNumber(prakritiML.pitta, 0.33)).toFixed(6)),
    kapha: 0, // Computed below to ensure sum = 1
  };
  mergedPrakriti.kapha = Number((1 - mergedPrakriti.vata - mergedPrakriti.pitta).toFixed(6));

  // 3. Signal Merge (Symptoms)
  const userSymptoms = toSafeArray(safeUserState.symptoms || safeUserState.symptom_tags);
  const mlSignals = toSafeArray(mlData.signals);
  const combinedSymptoms = Array.from(new Set([...userSymptoms, ...mlSignals])).filter(Boolean);

  // 4. Return Interpreted State
  return {
    userState: {
      ...safeUserState,
      dosha_estimate: mergedPrakriti,
      symptoms: combinedSymptoms,
    },
    ml_used: true,
    ml_confidence: toSafeNumber(mlData.confidence, 0),
    ml_contribution_weight: mlWeight,
  };
}

module.exports = {
  mergeInterpretation,
};
