const { applyDiversity } = require("../src/modules/diversity/diversityEngine");

const candidates = {
  Main: [
    { recipe_id: "lentil_soup", name: "Lentil Soup", score: 0.9, category: "Main" },
    { recipe_id: "chicken_salad", name: "Chicken Salad", score: 0.2, category: "Main" }, // Low score to test 50% cap
  ],
};

function test(label, history = []) {
  console.log(`\n--- Test: ${label} ---`);
  
  // Issue 4: History passed via context.history
  const userHistory = {
    persistentHistory: history 
  };

  const result = applyDiversity(candidates, userHistory);
  const stats = result.__stageStats;
  
  Object.keys(result).forEach(cat => {
    result[cat].forEach(food => {
      console.log(`Food: ${food.name}, BaseScore: ${food.score}, Penalty: ${food.diversityPenalty}, Final: ${food.finalScore}`);
    });
  });
  
  console.log(`Stats: Matches=${stats.historical_matches_count}, PenaltySum=${stats.diversity_penalty_applied}`);
}

// 1. Issue 3: Discrete Buckets (23h, 25h, 49h, 73h)
console.log("Checking discrete buckets (1.0, 0.7, 0.4, 0.1)...");
test("Bucket 0-24h (1.0)", [
  { meal_id: "lentil_soup", timestamp: new Date(Date.now() - 23 * 3600000).toISOString() }
]);
test("Bucket 24-48h (0.7)", [
  { meal_id: "lentil_soup", timestamp: new Date(Date.now() - 25 * 3600000).toISOString() }
]);
test("Bucket 48-72h (0.4)", [
  { meal_id: "lentil_soup", timestamp: new Date(Date.now() - 49 * 3600000).toISOString() }
]);
test("Bucket >72h (0.1)", [
  { meal_id: "lentil_soup", timestamp: new Date(Date.now() - 73 * 3600000).toISOString() }
]);

// 2. Issue 5: Penalty Cap (50%)
console.log("\nChecking 50% penalty cap...");
test("Cap Test (Chicken Salad 0.2 score)", [
  { meal_id: "chicken_salad", timestamp: new Date().toISOString() } // Normal penalty 0.3
]);

// 3. Issue 6: Exact Match Only
console.log("\nChecking exact match only...");
test("No ID Match (Should be 0 penalty)", [
  { meal_id: "different_id", category: "Main", timestamp: new Date().toISOString() }
]);
