const { toSafeArray, toSafeNumber, toSafeObject, toSafeString } = require("../utils/safeUtils");

const DAILY_MEAL_TYPES = ["breakfast", "lunch", "dinner"];

function clamp01(value) {
  return Math.max(0, Math.min(1, toSafeNumber(value, 0)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMealType(value) {
  const normalized = toSafeString(value, "").toLowerCase();
  if (DAILY_MEAL_TYPES.includes(normalized)) {
    return normalized;
  }
  return "lunch";
}

function toHistoryEntries(mealType, response, timestamp) {
  const meals = toSafeArray(toSafeObject(response).meal_plan);
  return meals.map((meal, index) => {
    const safeMeal = toSafeObject(meal);
    const recipeId = toSafeString(safeMeal.recipe_id || safeMeal.name, "meal");
    const category = normalizeMealType(mealType);
    const offset = Math.max(0, Math.trunc(index));
    return {
      meal_id: recipeId,
      category,
      timestamp: new Date(timestamp + offset * 1000).toISOString(),
    };
  });
}

function buildDailyMeta(breakfast, lunch, dinner) {
  const meals = [breakfast, lunch, dinner];
  const scoreAvg = meals.reduce((sum, meal) => sum + clamp01(toSafeObject(meal).score), 0) / meals.length;
  const confidenceAvg = meals.reduce((sum, meal) => sum + clamp01(toSafeObject(toSafeObject(meal).confidence).value), 0) / meals.length;

  return {
    score_avg: Number(scoreAvg.toFixed(6)),
    confidence_avg: Number(confidenceAvg.toFixed(6)),
  };
}

async function generateDailyPlan(input, deps = {}) {
  const safeInput = toSafeObject(input);
  const runPlan = typeof deps.runPlan === "function" ? deps.runPlan : null;

  if (!runPlan) {
    throw new Error("generateDailyPlan requires deps.runPlan");
  }

  const baseState = clone(safeInput);
  const safeMeta = toSafeObject(baseState.meta);
  const seedTimestamp = Math.max(0, Math.trunc(toSafeNumber(safeMeta.timestamp, Date.now())));
  const history = [];

  const runMeal = async (mealType, index) => {
    const requestTimestamp = seedTimestamp + index * 10000;
    const response = await runPlan({
      ...clone(baseState),
      request_id: `${toSafeString(baseState.request_id, "daily_request")}_${mealType}`,
      trace_id: `${toSafeString(baseState.trace_id, "daily_trace")}_${mealType}`,
      mealType,
      userState: {
        ...toSafeObject(baseState.userState),
        context: {
          ...toSafeObject(toSafeObject(baseState.userState).context),
          meal_type: mealType,
        },
      },
      context: {
        ...toSafeObject(baseState.context),
        history: clone(history),
      },
      meta: {
        ...safeMeta,
        timestamp: requestTimestamp,
        request_source: "daily_planner",
      },
    });

    history.push(...toHistoryEntries(mealType, response, requestTimestamp));
    return response;
  };

  const breakfast = await runMeal("breakfast", 1);
  const lunch = await runMeal("lunch", 2);
  const dinner = await runMeal("dinner", 3);

  return {
    meals: {
      breakfast,
      lunch,
      dinner,
    },
    meta: buildDailyMeta(breakfast, lunch, dinner),
  };
}

module.exports = {
  DAILY_MEAL_TYPES,
  generateDailyPlan,
};
