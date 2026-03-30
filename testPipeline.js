const { runPipeline } = require("./src/pipeline/pipeline");

const diabeticUser = {
  conditions: ["diabetes"],
  diet: "veg",
  risk_flags: [],
};

const pittaUser = {
  conditions: [],
  diet: "veg",
  risk_flags: ["high_pitta"],
};

const mealType = "lunch";

const userHistory = {
  recentFoods: ["moong_dal"],
  categoryCount: { dal: 2 },
};

const foods = [
  {
    name: "white_rice",
    category: "grain",
    digestibility_score: 0.6,
    nutrition: { glycemic_index: 80 },
    meta: { is_vegetarian: true },
  },
  {
    name: "moong_dal",
    category: "dal",
    digestibility_score: 0.9,
    nutrition: { glycemic_index: 30 },
    meta: { is_vegetarian: true },
  },
  {
    name: "potato",
    category: "vegetable",
    digestibility_score: 0.5,
    nutrition: { glycemic_index: 85 },
    meta: { is_vegetarian: true },
  },
  {
    name: "lauki",
    category: "vegetable",
    digestibility_score: 0.8,
    nutrition: { glycemic_index: 20 },
    meta: { is_vegetarian: true },
  },
];

const rules = [
  {
    id: "diabetes_high_gi",
    priority: "P1",
    logic_tree: {
      AND: [
        { "user.conditions": "diabetes" },
        { "food.nutrition.glycemic_index": { ">": 70 } },
      ],
    },
    action: { type: "reject", reason: "High GI unsafe" },
  },
];

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return;
  }

  console.log("PASS:", message);
}

console.log("=== DIABETIC USER ===");
const diabeticResult = runPipeline({
  userState: diabeticUser,
  mealType,
  foods,
  rules,
  userHistory,
});
console.log(JSON.stringify(diabeticResult, null, 2));

console.log("=== PITTA USER ===");
const pittaResult = runPipeline({
  userState: pittaUser,
  mealType,
  foods,
  rules,
  userHistory,
});
console.log(JSON.stringify(pittaResult, null, 2));

assert(
  !diabeticResult.meal.includes("white_rice"),
  "High GI food must be rejected"
);

assert(
  diabeticResult.meal.length > 0,
  "Meal must be generated"
);

assert(
  diabeticResult.explanation !== undefined,
  "Explanation must exist"
);

assert(
  !diabeticResult.meal.includes("moong_dal") || diabeticResult.score < 10,
  "Diversity should affect repeated foods"
);

const repeat = runPipeline({
  userState: diabeticUser,
  mealType,
  foods,
  rules,
  userHistory,
});

assert(
  JSON.stringify(diabeticResult) === JSON.stringify(repeat),
  "Pipeline must be deterministic"
);

console.log("ALL SYSTEM TESTS COMPLETED");
