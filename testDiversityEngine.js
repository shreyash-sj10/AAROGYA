const { applyDiversity } = require("./src/modules/diversity/diversityEngine");
const { scoreCandidates } = require("./src/modules/scoring/scoringEngine");
const { generateCandidates } = require("./src/modules/candidate/candidateGenerator");
const { getBestTemplate } = require("./src/modules/templates/mealTemplate.service");

const userState = {
  conditions: [],
  diet: "veg",
  risk_flags: [],
};

const userHistory = {
  recentFoods: ["moong_dal", "roti"],
  categoryCount: {
    dal: 3,
    vegetable: 1,
  },
};

const foods = [
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
    nutrition: { glycemic_index: 20 },
    meta: { is_vegetarian: true },
  },
];

const rules = [];

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
const diversified = applyDiversity(scored, userHistory);

console.log("Diversified Output:", JSON.stringify(diversified, null, 2));

assert(
  typeof diversified.dal[0].finalScore === "number",
  "finalScore must exist"
);

assert(
  diversified.dal[0].score !== undefined,
  "Original score must be preserved"
);

const moong = diversified.dal.find((food) => food.name === "moong_dal");
assert(
  moong.diversityPenalty > 0,
  "Repeated food should have penalty"
);

const toor = diversified.dal.find((food) => food.name === "toor_dal");
assert(
  toor.diversityPenalty <= moong.diversityPenalty,
  "Non-repeated food should have lower penalty"
);

assert(
  moong.diversityPenalty >= 0.15,
  "Category repetition scale should remain meaningful"
);

assert(
  Math.abs(moong.finalScore - (moong.score - moong.diversityPenalty)) < 0.001,
  "finalScore must be score - penalty"
);

const dalList = diversified.dal;
for (let i = 1; i < dalList.length; i += 1) {
  assert(
    dalList[i - 1].finalScore >= dalList[i].finalScore,
    "Foods must be sorted by finalScore DESC"
  );
}

const diversified2 = applyDiversity(scored, userHistory);
assert(
  JSON.stringify(diversified) === JSON.stringify(diversified2),
  "Diversity output must be deterministic"
);

console.log("ALL DIVERSITY TESTS COMPLETED");
