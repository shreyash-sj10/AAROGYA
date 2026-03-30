const { loadAllFoods } = require("./src/modules/food");
const { buildUserState } = require("./src/modules/userState/userState.builder");
const { computeRiskFlags } = require("./src/modules/userState/riskFlag.engine");
const { generateCandidates } = require("./src/modules/candidate/candidate.generator");
const { scoreCandidates } = require("./src/modules/scoring/scoring.engine");
const { optimizeMeal } = require("./src/modules/optimizer/meal.optimizer");
const rules = require("./src/modules/rules/rule.samples");

const userDB = {
  id: 1,
  vata: 0.2,
  pitta: 0.7,
  kapha: 0.1,
  agni_strength: 0.3,
  conditions: ["pcos"],
  allergies: [],
  diet_type: "veg",
};

const genAIInput = {
  symptom_tags: ["acidity"],
};

const userInput = {
  goal_vector: {
    weight_loss: 0.8,
    muscle_gain: 0.1,
    maintenance: 0.1,
  },
  context: {
    meal_time: "dinner",
    season: "summer",
  },
};

const userState = buildUserState(userDB, genAIInput, userInput);
const finalUserState = {
  ...userState,
  risk_flags: computeRiskFlags(userState),
};

const candidates = generateCandidates(
  finalUserState,
  ["dal", "vegetable"],
  loadAllFoods(),
  rules
);

const scoredCandidates = scoreCandidates(finalUserState, candidates);
const result = optimizeMeal(finalUserState, scoredCandidates);

console.log(JSON.stringify(result, null, 2));
