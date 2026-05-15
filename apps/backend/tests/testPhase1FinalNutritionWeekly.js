const { generateWeeklyPlan } = require("../src/modules/planner/weeklyPlanner.service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const result = await generateWeeklyPlan({
    user_context: {
      user_id: "phase1_final_nutrition",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      diet_type: "vegetarian",
      context: { season: "summer" },
      target_calories: 700,
    },
    constraints: {
      max_calories: 750,
      diet_type: "vegetarian",
      season: "summer",
    },
    preferences: {},
    days: 7,
  });

  const missing = [];
  for (const day of result.weekly_plan || []) {
    for (const meal of day.meal_plan || []) {
      const n = meal.nutrition || {};
      const valid = Number.isFinite(n.calories)
        && Number.isFinite(n.protein)
        && Number.isFinite(n.carbs)
        && Number.isFinite(n.fat);

      if (!valid) {
        missing.push({ day: day.day, recipe_id: meal.recipe_id });
      }
    }
  }

  assert(missing.length === 0, `missing nutrition in weekly meal entries: ${JSON.stringify(missing.slice(0, 10))}`);
  console.log("PASS: nutrition present in all weekly meal_plan entries");
})();
