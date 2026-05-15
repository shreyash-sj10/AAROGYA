const { FOOD_CATEGORIES } = require("../src/modules/food/food.schema");
const { loadAllFoods, getFoodsByCategory } = require("../src/modules/food/food.service");

const foods = loadAllFoods();

console.log(`Total foods: ${foods.length}`);

for (const category of FOOD_CATEGORIES) {
  console.log(`${category}: ${getFoodsByCategory(category).length}`);
}
