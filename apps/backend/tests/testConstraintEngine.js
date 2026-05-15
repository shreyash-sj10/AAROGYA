const { filterFoods } = require("../src/rules/engine/constraintEngine");

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

// ─── TEST 5: P0 strict-first-pass ────────────────────────────────────────────
console.log("\n--- TEST 5: P0 strict-first-pass evaluation ---");

const p0AllergyRule = {
  id: "p0_test_allergy",
  priority: "P0",
  type: "hard_constraint",
  logic_tree: {
    AND: [
      { "user.allergies": "shellfish" },
      { "food.meta.allergy_tag": "shellfish" },
    ],
  },
  action: { type: "reject", reason: "P0: shellfish allergy violation" },
};

const p1PenaltyRule = {
  id: "p1_test_gi",
  priority: "P1",
  logic_tree: {
    AND: [{ "user.conditions": "diabetes" }, { "food.nutrition.glycemic_index": { ">": 70 } }],
  },
  action: { type: "reject", reason: "P1: high GI for diabetes" },
};

const allergyUserState = { allergies: ["shellfish"], conditions: [], context: {} };
const allergyFoods = [
  { id: "shrimp", name: "Shrimp", meta: { allergy_tag: "shellfish" }, nutrition: { glycemic_index: 40 } },
  { id: "dal", name: "Toor Dal", meta: { allergy_tag: "legume" }, nutrition: { glycemic_index: 30 } },
];

const p0Result = filterFoods(allergyFoods, allergyUserState, [p0AllergyRule, p1PenaltyRule]);

assert(
  p0Result.rejectedFoods.some((r) => r.food.name === "Shrimp"),
  "TEST 5: Shrimp rejected by P0 allergy rule"
);
assert(
  p0Result.rejectedFoods.find((r) => r.food.name === "Shrimp")?.triggeredRule.priority === "P0",
  "TEST 5: rejection is attributed to P0 priority"
);
assert(
  p0Result.validFoods.some((f) => f.name === "Toor Dal"),
  "TEST 5: Toor Dal passes P0 check"
);

// ─── TEST 6: P0 stats fields populated ───────────────────────────────────────
console.log("\n--- TEST 6: P0 stats fields in filterFoods result ---");

assert(
  typeof p0Result.stats.p0_rules_checked === "number",
  "TEST 6: stats.p0_rules_checked is a number"
);
assert(
  p0Result.stats.p0_rules_checked >= 1,
  "TEST 6: stats.p0_rules_checked >= 1 (canonical + test P0 rules)"
);
assert(
  p0Result.stats.p0_violations === 1,
  "TEST 6: stats.p0_violations = 1 (shrimp violated P0)"
);
assert(
  Array.isArray(p0Result.stats.p0_violated_rule_ids),
  "TEST 6: stats.p0_violated_rule_ids is an array"
);
assert(
  p0Result.stats.p0_violated_rule_ids.includes("p0_test_allergy"),
  "TEST 6: violated rule ID 'p0_test_allergy' is in p0_violated_rule_ids"
);

console.log("\nALL TESTS COMPLETED");



