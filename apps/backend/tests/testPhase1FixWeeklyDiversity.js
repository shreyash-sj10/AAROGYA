const { generateWeeklyPlan } = require("../src/modules/planner/weeklyPlanner.service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeMealId(id) {
  const raw = String(id || "").toLowerCase();
  const withoutDay = raw.replace(/^d\d+:/, "");
  const parts = withoutDay.split(":");
  if (parts.length > 1 && (parts[0] === "breakfast" || parts[0] === "lunch" || parts[0] === "dinner")) {
    return parts.slice(1).join(":");
  }
  return withoutDay;
}

(async () => {
  const result = await generateWeeklyPlan({
    user_context: {
      user_id: "phase1_fix_weekly",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      diet_type: "vegetarian",
      context: { season: "summer" },
      target_calories: 650,
    },
    constraints: {
      max_calories: 700,
      diet_type: "vegetarian",
      season: "summer",
    },
    preferences: {},
    days: 7,
  });

  const byMealIdDays = new Map();

  for (const dayEntry of result.weekly_plan || []) {
    const day = Number(dayEntry.day);
    for (const meal of dayEntry.meal_plan || []) {
      const mealId = normalizeMealId(meal.recipe_id);
      if (!mealId) continue;

      if (!byMealIdDays.has(mealId)) {
        byMealIdDays.set(mealId, new Set());
      }
      byMealIdDays.get(mealId).add(day);
    }
  }

  const repeatedAcrossDays = Array.from(byMealIdDays.entries()).filter(([, days]) => days.size > 1);

  assert(repeatedAcrossDays.length === 0, `Repeated meal IDs across days: ${JSON.stringify(repeatedAcrossDays.map(([id, d]) => ({ id, days: Array.from(d) })))}`);
  console.log("PASS: weekly diversity enforces no repeated normalized meal IDs across days");
})();
