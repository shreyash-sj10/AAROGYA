const rules = require("../src/rules/engine/rule.samples");
const { applyRules } = require("../src/rules/engine/rule.engine");

const user = {
  conditions: ["pcos"],
  symptoms: ["bloating"],
  prakriti: {
    dominant_dosha: "pitta",
  },
  preferences: {
    is_vegetarian: true,
  },
};

const food = {
  id: "dry_001",
  name: "A2 Cow Ghee",
  category: "dairy",
  ayurveda: {
    guna: ["heavy", "oily", "stable"],
    virya: "hot",
  },
  dosha_effect: {
    pitta: 0.4,
  },
  functional: {
    digestibility_score: 0.45,
    heaviness_score: 0.8,
  },
  nutrition: {
    glycemic_index: 72,
  },
  meta: {
    is_vegetarian: true,
  },
};

const context = {
  meal_time: "night",
  season: "summer",
};

const result = applyRules(rules, user, food, context);

console.log(JSON.stringify(result, null, 2));

