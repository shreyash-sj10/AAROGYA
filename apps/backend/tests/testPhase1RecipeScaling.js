const { applyRecipeScaling } = require("../src/modules/recipe/recipeScaling.service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(() => {
  const mealResult = {
    meal: ["dal", "rice"],
    score: 0.8,
    breakdown: {
      items: [
        {
          recipe_id: "dal",
          name: "dal",
          quantity: { value: 100, unit: "grams" },
          nutrition: { calories: 100, protein: 8, carbs: 12, fat: 2 },
        },
        {
          recipe_id: "rice",
          name: "rice",
          quantity: { value: 100, unit: "grams" },
          nutrition: { calories: 100, protein: 2, carbs: 22, fat: 0.4 },
        },
      ],
      meta: {},
    },
  };

  const scaled = applyRecipeScaling({
    mealResult,
    userState: { context: { target_calories: 150 } },
    constraints: { max_calories: 150 },
    mealType: "lunch",
  });

  const items = scaled.breakdown.items;
  const totalCalories = items.reduce((sum, item) => sum + item.nutrition.calories, 0);

  assert(totalCalories <= 150.001, "scaled calories must be adjusted to target");
  assert(Math.abs(totalCalories - 150) < 0.01, "scaled calories must match target calories");
  assert(items.every((item) => item.scaled_recipe && typeof item.scaled_recipe.quantity === "string"), "scaled_recipe must be generated");

  console.log("PASS: recipe scaling adjusted portions and calories correctly");
})();
