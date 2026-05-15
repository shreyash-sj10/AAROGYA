const { generateWeeklyPlan } = require("../src/modules/planner/weeklyPlanner.service");
const { validatePlanWeeklyResponse } = require("../src/contracts/validators/validatePlanWeeklyResponse");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const request = {
    user_context: {
      user_id: "phase1_weekly_user",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      diet_type: "vegetarian",
      context: { season: "summer" },
      target_calories: 600,
    },
    constraints: {
      max_calories: 700,
      diet_type: "vegetarian",
      season: "summer",
    },
    preferences: {
      liked_foods: ["moong_dal"],
      disliked_foods: ["fried_food"],
      interaction_logs: [
        { action: "selected", food: "moong_dal" },
      ],
    },
    days: 7,
  };

  const result = await generateWeeklyPlan(request);
  const validation = validatePlanWeeklyResponse(result);
  assert(validation.valid, `PlanWeeklyResponse_v1 validation failed: ${JSON.stringify(validation.errors || [])}`);
  assert(Array.isArray(result.weekly_plan), "weekly_plan must be an array");
  assert(result.weekly_plan.length === 7, "weekly_plan must contain 7 days");

  const allRecipeIds = result.weekly_plan
    .flatMap((day) => Array.isArray(day.meal_plan) ? day.meal_plan : [])
    .map((meal) => String(meal.recipe_id || "").toLowerCase())
    .filter(Boolean);

  const uniqueRecipeIds = new Set(allRecipeIds);
  assert(uniqueRecipeIds.size === allRecipeIds.length, "weekly_plan contains repeated meals");

  console.log("PASS: weekly planner produced a valid 7-day plan with no repeated meals");
})();
