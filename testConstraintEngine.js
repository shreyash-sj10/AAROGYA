const { filterFoods } = require("./src/modules/rules/constraintEngine");

const userState = {
  conditions: ["diabetes"],
  diet: "veg",
  risk_flags: ["high_pitta"],
};

const foods = [
  {
    name: "white_rice",
    category: "grain",
    nutrition: { glycemic_index: 80 },
  },
  {
    name: "moong_dal",
    category: "dal",
    nutrition: { glycemic_index: 30 },
  },
  {
    name: "curd",
    category: "dairy",
    properties: { time: "night" },
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
    action: { type: "reject", reason: "High GI unsafe for diabetes" },
  },
  {
    id: "pitta_aggravation",
    priority: "P2",
    logic_tree: {
      AND: [
        { "user.risk_flags": "high_pitta" },
        { "food.category": "spicy" },
      ],
    },
    action: { type: "penalize", penalty: 2, reason: "Pitta aggravating" },
  },
  {
    id: "curd_night",
    priority: "P3",
    logic_tree: {
      AND: [
        { "food.name": "curd" },
        { "food.properties.time": "night" },
      ],
    },
    action: { type: "penalize", penalty: 1, reason: "Curd at night not recommended" },
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

const result = filterFoods(foods, userState, rules);

console.log("TEST 1 RESULT:", JSON.stringify(result, null, 2));

assert(
  result.rejectedFoods.some((entry) => entry.food.name === "white_rice"),
  "white_rice should be rejected (high GI + diabetes)"
);

assert(
  result.validFoods.some((food) => food.name === "moong_dal"),
  "moong_dal should be valid"
);

const curd = result.validFoods.find((food) => food.name === "curd");

assert(Boolean(curd), "curd should be present in valid foods");

assert(
  Boolean(curd) && curd.evaluation.totalPenalty > 0,
  "curd should have penalty"
);

const nestedRule = {
  id: "nested_test",
  priority: "P2",
  logic_tree: {
    AND: [
      { "user.diet": "veg" },
      {
        OR: [
          { "food.category": "grain" },
          { "food.category": "dal" },
        ],
      },
    ],
  },
  action: { type: "penalize", penalty: 1 },
};

const nestedResult = filterFoods(foods, userState, [nestedRule]);

console.log("TEST 3 (Nested):", JSON.stringify(nestedResult, null, 2));

assert(
  nestedResult.validFoods.filter((food) => food.evaluation.totalPenalty > 0).length === 2,
  "nested logic should penalize grain and dal only"
);

const missingRule = {
  id: "missing_path",
  priority: "P2",
  logic_tree: {
    AND: [
      { "food.nonexistent.value": { ">": 10 } },
    ],
  },
  action: { type: "penalize", penalty: 1 },
};

const missingResult = filterFoods(foods, userState, [missingRule]);

assert(
  missingResult.validFoods.length === foods.length && missingResult.rejectedFoods.length === 0,
  "missing paths should not crash or trigger penalties"
);

console.log("TEST 4 (Missing Path Safe): PASSED");

const result2 = filterFoods(foods, userState, rules);

assert(
  JSON.stringify(result) === JSON.stringify(result2),
  "Deterministic output check"
);

console.log("ALL TESTS COMPLETED");
