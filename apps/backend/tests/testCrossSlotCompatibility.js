const { getBestTemplate } = require("../src/templates/mealTemplate.service");
const { generateCandidates } = require("../src/modules/candidate/candidateGenerator");
const { applyConstraints } = require("../src/modules/constraint/constraintEngine");
const { scoreCandidates } = require("../src/modules/scoring/scoringEngine");
const { applyDiversity } = require("../src/modules/diversity/diversityEngine");
const { optimizeMeal } = require("../src/modules/optimizer/optimizer");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function itemId(item) {
  if (!item || typeof item !== "object") {
    return "";
  }
  return String(item.recipe_id || item.id || item.name || "");
}

function collectCategoryIds(map) {
  const out = {};
  Object.keys(map || {}).forEach((key) => {
    out[key] = toSafeArray(map[key]).map((item) => itemId(item)).filter(Boolean);
  });
  return out;
}

(function runCrossSlotCompatibilityTests() {
  const template = getBestTemplate("lunch");

  const foods = [
    {
      id: "dal_hot_bad",
      name: "Dal Hot Bad",
      category: "dal",
      ayurveda: { virya: "hot", guna: ["light"], rasa: ["pungent"], vipaka: "pungent" },
      dosha_effect: { pitta: 0.8, vata: 0.1, kapha: -0.1 },
      functional: { digestibility_score: 0.8, heaviness_score: 0.2 },
      nutrition: { calories: 100, protein: 10, carbs: 12, fat: 3, glycemic_index: 30 },
      meta: { is_vegetarian: true },
    },
    {
      id: "dal_safe_good",
      name: "Dal Safe Good",
      category: "dal",
      ayurveda: { virya: "cold", guna: ["light"], rasa: ["sweet"], vipaka: "sweet" },
      dosha_effect: { pitta: -0.4, vata: 0.1, kapha: -0.1 },
      functional: { digestibility_score: 0.9, heaviness_score: 0.2 },
      nutrition: { calories: 95, protein: 11, carbs: 10, fat: 2, glycemic_index: 25 },
      meta: { is_vegetarian: true },
    },
    {
      id: "veg_hot_bad",
      name: "Veg Hot Bad",
      category: "vegetable",
      ayurveda: { virya: "hot", guna: ["light"], rasa: ["pungent"], vipaka: "pungent" },
      dosha_effect: { pitta: 0.7, vata: 0.2, kapha: -0.2 },
      functional: { digestibility_score: 0.8, heaviness_score: 0.2 },
      nutrition: { calories: 45, protein: 3, carbs: 8, fat: 1, glycemic_index: 20 },
      meta: { is_vegetarian: true },
    },
    {
      id: "veg_safe_good",
      name: "Veg Safe Good",
      category: "vegetable",
      ayurveda: { virya: "cold", guna: ["light"], rasa: ["sweet"], vipaka: "sweet" },
      dosha_effect: { pitta: -0.5, vata: 0.1, kapha: -0.2 },
      functional: { digestibility_score: 0.88, heaviness_score: 0.2 },
      nutrition: { calories: 40, protein: 2, carbs: 7, fat: 1, glycemic_index: 15 },
      meta: { is_vegetarian: true },
    },
  ];

  const userState = {
    user_id: "cross_slot_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: ["high_pitta"],
    symptoms: ["acidity"],
    dosha_estimate: { vata: 0.2, pitta: 0.6, kapha: 0.2 },
    allergies: [],
    preferences: [],
    context: { meal_type: "lunch", season: "summer" },
  };

  const candidates = generateCandidates(template, foods, userState, sampleRules, { topK: 10 });
  const constrained = applyConstraints(template, candidates, userState, sampleRules, { topK: 10 });
  const scored = scoreCandidates(constrained, userState, template);
  const diversified = applyDiversity(scored, {
    recentFoods: ["dal hot bad", "veg hot bad"],
    multiDayHistory: [
      { meals: [{ name: "Dal Hot Bad", category: "dal" }] },
      { meals: [{ name: "Veg Hot Bad", category: "vegetable" }] },
    ],
    categoryRotationOrder: ["dal", "vegetable"],
    rotationIndex: 0,
  });
  const optimized = optimizeMeal(template, diversified);

  const constrainedIds = collectCategoryIds(constrained);
  const selectedIds = toSafeArray(optimized.breakdown && optimized.breakdown.items).map((item) => itemId(item));

  assert(!constrainedIds.dal.includes("dal_hot_bad"), "incompatible dal candidate should be rejected by constraints");
  assert(!constrainedIds.vegetable.includes("veg_hot_bad"), "incompatible vegetable candidate should be rejected by constraints");
  assert(constrainedIds.dal.includes("dal_safe_good"), "safe dal should remain after constraints");
  assert(constrainedIds.vegetable.includes("veg_safe_good"), "safe vegetable should remain after constraints");

  selectedIds.forEach((selectedId) => {
    const allowed = constrainedIds.dal.includes(selectedId) || constrainedIds.vegetable.includes(selectedId);
    assert(allowed, `optimizer selected candidate outside constrained set: ${selectedId}`);
  });

  assert(!selectedIds.includes("dal_hot_bad"), "optimizer must not output rejected dal candidate");
  assert(!selectedIds.includes("veg_hot_bad"), "optimizer must not output rejected vegetable candidate");

  console.log("PASS: incompatible slot combinations are rejected upstream and optimizer selections remain within constrained slot candidates");
})();

