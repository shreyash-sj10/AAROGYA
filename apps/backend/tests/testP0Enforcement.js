const { filterFoods } = require("../src/rules/engine/constraintEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(function runP0EnforcementTest() {
  const foods = [
    {
      id: "food_1",
      recipe_id: "food_1",
      name: "Peanut Curry",
      category: "dal",
      meta: {
        allergy_tag: "peanut",
        is_vegetarian: true,
      },
    },
  ];

  const userState = {
    allergies: ["peanut"],
    conditions: [],
    context: {
      diet_type: "vegetarian",
      season: "summer",
      meal_type: "lunch",
    },
  };

  const result = filterFoods(foods, userState, []);
  assert(Array.isArray(result.validFoods) && result.validFoods.length === 0, "Expected P0 to reject allergen food");
  assert(Array.isArray(result.rejectedFoods) && result.rejectedFoods.length === 1, "Expected one rejected food");
  assert((result.stats.p0_violations || 0) >= 1, "Expected p0 violation count to increment");

  console.log("PASS: canonical P0 rules are enforced during filtering");
})();
