const { scoreCandidates } = require("./src/modules/scoring/scoringEngine");
const { generateCandidates } = require("./src/modules/candidate/candidateGenerator");
const { getBestTemplate } = require("./src/modules/templates/mealTemplate.service");

const userState = {
  conditions: ["diabetes"],
  diet: "veg",
  goal: "maintenance",
  risk_flags: ["high_pitta"],
};

const foods = [
  {
    name: "moong_dal",
    category: "dal",
    digestibility_score: 0.9,
    nutrition: { glycemic_index: 30, protein: 24 },
    dosha_effect: { pitta: -1 },
    meta: { is_vegetarian: true },
  },
  {
    name: "toor_dal",
    category: "dal",
    digestibility_score: 0.7,
    nutrition: { glycemic_index: 50, protein: 18 },
    dosha_effect: { pitta: 0 },
    meta: { is_vegetarian: true },
  },
  {
    name: "potato",
    category: "vegetable",
    digestibility_score: 0.5,
    nutrition: { glycemic_index: 85 },
    dosha_effect: { pitta: 1 },
    meta: { is_vegetarian: true },
  },
  {
    name: "lauki",
    category: "vegetable",
    digestibility_score: 0.8,
    nutrition: { glycemic_index: 20 },
    dosha_effect: { pitta: -1 },
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
const candidates = generateCandidates(template, foods, userState, rules);
const scored = scoreCandidates(candidates, userState, template);

console.log("Scored Output:", JSON.stringify(scored, null, 2));

assert(
  typeof scored.dal[0].score === "number",
  "Score must exist"
);

assert(
  scored.dal[0].breakdown && typeof scored.dal[0].breakdown.nutrition === "number",
  "Breakdown must exist"
);

assert(
  scored.dal[0].breakdown.penalty !== undefined,
  "Penalty must be included"
);

const dalList = scored.dal;

assert(
  dalList[0].name === "moong_dal",
  "Lower GI dal should rank higher"
);

assert(
  dalList[0].breakdown.digestibility >= dalList[1].breakdown.digestibility,
  "Higher digestibility should increase score"
);

assert(
  scored.vegetable[0].name === "lauki",
  "Cooling food should rank higher for high pitta"
);

for (let i = 1; i < scored.dal.length; i += 1) {
  assert(
    scored.dal[i - 1].score >= scored.dal[i].score,
    "Foods must be sorted by score DESC"
  );
}

const scored2 = scoreCandidates(candidates, userState, template);

assert(
  JSON.stringify(scored) === JSON.stringify(scored2),
  "Scoring must be deterministic"
);

console.log("ALL SCORING TESTS COMPLETED");
