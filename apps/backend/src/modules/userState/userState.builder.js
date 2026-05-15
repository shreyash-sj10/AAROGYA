const { interpretSymptoms, parseUserInputDeterministic } = require("./symptomInterpreter");
const { validateAIProfile } = require("../../contracts/validators/validateAIProfile");
const { logLLMValidation, logLLMFallback } = require("../../observability/llm.logger");
const { toSafeNumber, toSafeString, toSafeArray } = require("../../utils/safeUtils");

const DEFAULT_PRAKRITI = {
  vata: 0,
  pitta: 0,
  kapha: 0,
};

const DEFAULT_GOAL_VECTOR = {
  weight_loss: 0.33,
  muscle_gain: 0.33,
  maintenance: 0.33,
};

const DEFAULT_CONTEXT = {
  meal_time: "lunch",
  season: "summer",
};

const AI_CONFIDENCE_THRESHOLD = 0.6;

function toSafeStringArray(value) {
  return toSafeArray(value)
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGoalVector(goalVector) {
  const safeGoalVector = goalVector && typeof goalVector === "object" ? goalVector : {};

  return {
    weight_loss: toSafeNumber(safeGoalVector.weight_loss, DEFAULT_GOAL_VECTOR.weight_loss),
    muscle_gain: toSafeNumber(safeGoalVector.muscle_gain, DEFAULT_GOAL_VECTOR.muscle_gain),
    maintenance: toSafeNumber(safeGoalVector.maintenance, DEFAULT_GOAL_VECTOR.maintenance),
  };
}

function normalizeContext(context) {
  const safeContext = context && typeof context === "object" ? context : {};

  return {
    meal_time: toSafeString(safeContext.meal_time, DEFAULT_CONTEXT.meal_time),
    season: toSafeString(safeContext.season, DEFAULT_CONTEXT.season),
  };
}

function normalizeDosha(value) {
  const safeValue = value && typeof value === "object" ? value : {};
  const vata = Math.max(0, toSafeNumber(safeValue.vata, 0));
  const pitta = Math.max(0, toSafeNumber(safeValue.pitta, 0));
  const kapha = Math.max(0, toSafeNumber(safeValue.kapha, 0));
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return { vata: 0.34, pitta: 0.33, kapha: 0.33 };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));

  return {
    vata: nv,
    pitta: np,
    kapha: Number((1 - nv - np).toFixed(6)),
  };
}

function buildUserState(userDB, genAIInput, userInput) {
  const safeUserDB = userDB && typeof userDB === "object" ? userDB : {};
  const safeGenAIInput = genAIInput && typeof genAIInput === "object" ? genAIInput : {};
  const safeUserInput = userInput && typeof userInput === "object" ? userInput : {};
  const interpretedSymptoms = interpretSymptoms(safeGenAIInput.symptom_tags, safeGenAIInput);

  return {
    user_id: Number.isInteger(safeUserDB.id) ? safeUserDB.id : 0,
    prakriti: {
      vata: toSafeNumber(safeUserDB.vata, DEFAULT_PRAKRITI.vata),
      pitta: toSafeNumber(safeUserDB.pitta, DEFAULT_PRAKRITI.pitta),
      kapha: toSafeNumber(safeUserDB.kapha, DEFAULT_PRAKRITI.kapha),
    },
    agni_strength: toSafeNumber(safeUserDB.agni_strength, 0.5),
    conditions: toSafeStringArray(safeUserDB.conditions),
    allergies: toSafeStringArray(safeUserDB.allergies),
    symptom_tags: interpretedSymptoms.symptom_tags,
    risk_flags: interpretedSymptoms.risk_flags,
    diet_type: toSafeString(safeUserDB.diet_type, ""),
    goal_vector: normalizeGoalVector(safeUserInput.goal_vector),
    context: normalizeContext(safeUserInput.context),
  };
}

async function buildUserStateWithAI(userDB, userInput = {}) {
  const safeUserInput = userInput && typeof userInput === "object" ? userInput : {};
  const text = toSafeString(safeUserInput.text || safeUserInput.userInput || safeUserInput.query, "");

  const deterministic = parseUserInputDeterministic(text);
  const validationInput = {
    version: "AIProfileOutput_v1",
    schema_version: 1,
    compatibility: "backward",
    risk_flags: toSafeStringArray(deterministic.risk_flags),
    dosha_estimate: normalizeDosha(deterministic.dosha_estimate),
    confidence: Math.max(0, Math.min(1, toSafeNumber(deterministic.confidence, 0.5))),
  };

  const validation = validateAIProfile(validationInput);
  logLLMValidation({
    endpoint: "ai/profile",
    request_id: "user_state_builder",
    valid: validation.valid,
    errors: validation.errors || [],
  });

  let profiled = {
    risk_flags: validationInput.risk_flags,
    dosha_estimate: validationInput.dosha_estimate,
    confidence: validationInput.confidence,
  };

  if (!validation.valid || toSafeNumber(validationInput.confidence, 0) < AI_CONFIDENCE_THRESHOLD) {
    logLLMFallback({
      endpoint: "ai/profile",
      request_id: "user_state_builder",
      reason: validation.valid ? "confidence_below_threshold" : "schema_invalid",
    });

    profiled = {
      risk_flags: toSafeStringArray(deterministic.risk_flags),
      dosha_estimate: normalizeDosha(deterministic.dosha_estimate),
      confidence: Math.max(0, Math.min(1, toSafeNumber(deterministic.confidence, 0.5))),
    };
  }

  const mergedGenAi = {
    symptom_tags: toSafeStringArray(deterministic.symptom_tags),
    risk_flags: profiled.risk_flags,
  };

  const built = buildUserState(userDB, mergedGenAi, safeUserInput);

  return {
    ...built,
    dosha_estimate: profiled.dosha_estimate,
    ai_profile_confidence: profiled.confidence,
  };
}

module.exports = {
  buildUserState,
  buildUserStateWithAI,
};
