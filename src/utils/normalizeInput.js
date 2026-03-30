function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value) {
  return toSafeArray(value)
    .map(normalizeString)
    .filter(Boolean);
}

function normalizeGoalVector(goalVector) {
  const safeGoalVector = goalVector && typeof goalVector === "object" ? goalVector : {};

  return {
    weight_loss: toSafeNumber(safeGoalVector.weight_loss, 0),
    muscle_gain: toSafeNumber(safeGoalVector.muscle_gain, 0),
    maintenance: toSafeNumber(safeGoalVector.maintenance, 0),
  };
}

function getNormalizedGoal(userState) {
  const goal = normalizeString(userState && userState.goal);

  if (["weight_loss", "muscle_gain", "maintenance"].includes(goal)) {
    return goal;
  }

  const goalVector = normalizeGoalVector(userState && userState.goal_vector);
  const rankedGoals = [
    { name: "weight_loss", value: goalVector.weight_loss },
    { name: "muscle_gain", value: goalVector.muscle_gain },
    { name: "maintenance", value: goalVector.maintenance },
  ];

  if (!rankedGoals.some((candidate) => candidate.value > 0)) {
    return "maintenance";
  }

  return rankedGoals.reduce((bestGoal, candidateGoal) => {
    if (candidateGoal.value > bestGoal.value) {
      return candidateGoal;
    }

    return bestGoal;
  }, rankedGoals[0]).name;
}

function normalizeUserState(userState) {
  const safeUserState = userState && typeof userState === "object" ? userState : {};
  const normalizedDiet = normalizeString(safeUserState.diet || safeUserState.diet_type);
  const goalVector = normalizeGoalVector(safeUserState.goal_vector);
  const goal = getNormalizedGoal({ ...safeUserState, goal_vector: goalVector });

  return {
    ...safeUserState,
    conditions: normalizeStringArray(safeUserState.conditions),
    risk_flags: normalizeStringArray(safeUserState.risk_flags),
    allergies: normalizeStringArray(safeUserState.allergies),
    diet: normalizedDiet,
    diet_type: normalizedDiet,
    goal,
    goal_vector: goalVector,
  };
}

function normalizeUserHistory(userHistory) {
  const safeUserHistory = userHistory && typeof userHistory === "object" ? userHistory : {};
  const safeCategoryCount = safeUserHistory.categoryCount && typeof safeUserHistory.categoryCount === "object"
    ? safeUserHistory.categoryCount
    : {};

  return {
    ...safeUserHistory,
    recentFoods: normalizeStringArray(safeUserHistory.recentFoods),
    categoryCount: Object.keys(safeCategoryCount).reduce((result, key) => {
      result[normalizeString(key)] = toSafeNumber(safeCategoryCount[key], 0);
      return result;
    }, {}),
  };
}

module.exports = {
  getNormalizedGoal,
  normalizeGoalVector,
  normalizeString,
  normalizeStringArray,
  normalizeUserHistory,
  normalizeUserState,
  toSafeArray,
  toSafeNumber,
};
