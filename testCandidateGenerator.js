const { generateCandidates } = require("./src/modules/candidate/candidateGenerator");
const { getBestTemplate } = require("./src/modules/templates/mealTemplate.service");

const userState = {
  conditions: ["diabetes"],
  diet: "veg",
  allergies: [],
  risk_flags: [],
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
    name: "toor_dal",
    category: "dal",
    digestibility_score: 0.7,
    nutrition: { glycemic_index: 50 },
    meta: { is_vegetarian: true },
  },
  {
    name: "lauki",
    category: "vegetable",
    digestibility_score: 0.8,
    meta: { is_vegetarian: true },
  },
  {
    name: "potato",
    category: "vegetable",
    digestibility_score: 0.5,
    nutrition: { glycemic_index: 85 },
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

const template = getBestTemplate("lunch");
console.log("Template:", JSON.stringify(template, null, 2));

const candidates = generateCandidates(template, foods, userState, rules);
console.log("Candidates:", JSON.stringify(candidates, null, 2));

assert(
  candidates.dal && candidates.vegetable,
  "Categories (dal, vegetable) should exist"
);

assert(
  !candidates.vegetable.some((food) => food.name === "potato"),
  "High GI food (potato) should be removed"
);

assert(
  candidates.dal.some((food) => food.name === "moong_dal"),
  "Valid dal should exist"
);

assert(
  typeof candidates.dal[0].scoreLite === "number",
  "scoreLite must be computed"
);

assert(
  candidates.dal[0].evaluation && typeof candidates.dal[0].evaluation.totalPenalty === "number",
  "evaluation object must exist"
);

const dalList = candidates.dal;
for (let i = 1; i < dalList.length; i += 1) {
  assert(
    dalList[i - 1].scoreLite >= dalList[i].scoreLite,
    "Candidates must be sorted by scoreLite DESC"
  );
}

assert(
  candidates.dal.length <= 5,
  "Top-K limit should be applied"
);

const candidates2 = generateCandidates(template, foods, userState, rules);
assert(
  JSON.stringify(candidates) === JSON.stringify(candidates2),
  "Output must be deterministic"
);

console.log("ALL TESTS COMPLETED");
