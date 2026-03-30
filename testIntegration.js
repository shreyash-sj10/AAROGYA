const { buildUserState } = require("./src/modules/userState/userState.builder");
const { computeRiskFlags } = require("./src/modules/userState/riskFlag.engine");
const { applyRules } = require("./src/modules/rules/rule.engine");
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
const riskFlags = computeRiskFlags(userState);
const finalUserState = {
  ...userState,
  risk_flags: riskFlags,
};

const food = {
  name: "white_rice",
  category: "grain",
  nutrition: { glycemic_index: 75 },
  dosha_effect: { pitta: 0.2 },
  functional: { heaviness_score: 0.4, digestibility_score: 0.8 },
  ayurveda: { virya: "cold" },
  meta: { is_vegetarian: true },
};

const result = applyRules(rules, finalUserState, food, finalUserState.context);

console.log("USER STATE:");
console.log(finalUserState);

console.log("\nFOOD:");
console.log(food);

console.log("\nRESULT:");
console.log(result);

const safeFood = {
  name: "moong_dal",
  category: "dal",
  nutrition: { glycemic_index: 35 },
  dosha_effect: { pitta: -0.2 },
  functional: { heaviness_score: 0.2, digestibility_score: 0.9 },
  ayurveda: { virya: "cold" },
  meta: { is_vegetarian: true },
};

const safeResult = applyRules(rules, finalUserState, safeFood, finalUserState.context);

console.log("\nSAFE FOOD:");
console.log(safeFood);

console.log("\nSAFE RESULT:");
console.log(safeResult);
