const { interpretSymptoms } = require("./symptomInterpreter");

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

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toSafeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
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

module.exports = {
  buildUserState,
};
