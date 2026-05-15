const { toSafeString, toSafeNumber, toSafeObject, toSafeArray } = require("./safeUtils");

function normalizeString(value) {
  return toSafeString(value).toLowerCase();
}

function normalizeStringArray(value) {
  return toSafeArray(value)
    .map(normalizeString)
    .filter(Boolean);
}

function normalizeGoalVector(goalVector) {
  if (!goalVector || typeof goalVector !== "object") return undefined;

  return {
    weight_loss: toSafeNumber(goalVector.weight_loss, 0),
    muscle_gain: toSafeNumber(goalVector.muscle_gain, 0),
    maintenance: toSafeNumber(goalVector.maintenance, 0),
  };
}

function getNormalizedGoal(userState) {
  const goal = normalizeString(userState && userState.goal);
  if (["weight_loss", "muscle_gain", "maintenance"].includes(goal)) {
    return goal;
  }
  
  if (userState && Array.isArray(userState.goals) && userState.goals.length > 0) {
    const firstGoal = normalizeString(userState.goals[0]);
    if (["weight_loss", "muscle_gain", "maintenance"].includes(firstGoal)) {
      return firstGoal;
    }
  }

  const goalVector = normalizeGoalVector(userState && userState.goal_vector);
  if (!goalVector) return undefined;

  const rankedGoals = [
    { name: "weight_loss", value: goalVector.weight_loss },
    { name: "muscle_gain", value: goalVector.muscle_gain },
    { name: "maintenance", value: goalVector.maintenance },
  ];

  if (!rankedGoals.some((candidate) => candidate.value > 0)) {
    return undefined;
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
  const normalizedDiet = normalizeString(safeUserState.diet || safeUserState.diet_type) || undefined;
  const goalVector = normalizeGoalVector(safeUserState.goal_vector);
  const goal = getNormalizedGoal({ ...safeUserState, goal_vector: goalVector });

  return {
    ...safeUserState,
    conditions: safeUserState.conditions ? normalizeStringArray(safeUserState.conditions) : undefined,
    risk_flags: safeUserState.risk_flags ? normalizeStringArray(safeUserState.risk_flags) : undefined,
    allergies: safeUserState.allergies ? normalizeStringArray(safeUserState.allergies) : undefined,
    diet: normalizedDiet,
    diet_type: normalizedDiet,
    goal,
    goal_vector: goalVector,
  };
}

function normalizeUserHistory(userHistory) {
  const safeUserHistory = userHistory && typeof userHistory === "object" ? userHistory : {};
  const safeCategoryCount = toSafeObject(safeUserHistory.categoryCount);

  return {
    ...safeUserHistory,
    recentFoods: normalizeStringArray(safeUserHistory.recentFoods),
    categoryCount: Object.keys(safeCategoryCount).reduce((result, key) => {
      result[normalizeString(key)] = toSafeNumber(safeCategoryCount[key], 0);
      return result;
    }, {}),
  };
}

function normalizePipelineContext(context) {
  const safe = toSafeObject(context);
  return {
    ...safe,
    history: toSafeArray(safe.history).map((entry) => {
      const safeEntry = toSafeObject(entry);
      return {
        meal_id: normalizeString(safeEntry.meal_id || safeEntry.mealId || safeEntry.id),
        category: normalizeString(safeEntry.category),
        timestamp: safeEntry.timestamp || new Date().toISOString(),
      };
    }),
  };
}

module.exports = {
  getNormalizedGoal,
  normalizeGoalVector,
  normalizeString,
  normalizeStringArray,
  normalizeUserHistory,
  normalizeUserState,
  normalizePipelineContext,
  toSafeArray,
  toSafeNumber,
  toSafeObject,
  toSafeString,
};
