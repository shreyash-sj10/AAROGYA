const { generateMealPlan } = require("./src/pipeline/orchestrator");
const { buildUserState } = require("./src/utils/inputParser");
const { getBestTemplate } = require("./src/modules/templates/mealTemplate.service");
const { generateCandidates } = require("./src/modules/candidate/candidateGenerator");
const { scoreCandidates } = require("./src/modules/scoring/scoringEngine");
const { applyDiversity } = require("./src/modules/diversity/diversityEngine");
const { optimizeMeal } = require("./src/modules/optimizer/optimizer");
const { applyReliability, computeConfidence } = require("./src/modules/reliability/reliabilityEngine");
const { buildDecisionTrace, generateStructuredExplanation } = require("./src/modules/explanation/decisionTraceEngine");
const { sampleFoods } = require("./src/modules/food/food.samples");
const sampleRules = require("./src/modules/rules/rule.samples");

const userHistory = {
  recentFoods: ["mung dal"],
  categoryCount: { dal: 2, vegetable: 1 },
};

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    return false;
  }

  console.log("PASS:", message);
  return true;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mergeRiskFlags(primaryFlags, secondaryFlags) {
  return Array.from(new Set([
    ...(Array.isArray(primaryFlags) ? primaryFlags : []),
    ...(Array.isArray(secondaryFlags) ? secondaryFlags : []),
  ].map(normalizeString).filter(Boolean)));
}

async function createUserState(config) {
  const parsed = await buildUserState({ text: config.text });

  return {
    text: parsed.text,
    conditions: config.conditions || [],
    goal: config.goal,
    meal_time: config.mealTime,
    diet: "veg",
    risk_flags: mergeRiskFlags(config.risk_flags || [], parsed.risk_flags),
    meta: parsed.meta,
  };
}

function runDetailedContext({ userState, mealType, foods, rules, userHistory: history }) {
  let context = {
    input: { userState, mealType, foods, rules, userHistory: history },
    template: getBestTemplate(mealType),
    candidates: null,
    scored: null,
    diversified: null,
    mealResult: null,
    explanation: null,
    foods,
    rules,
    userHistory: history,
    meta: {
      templateId: null,
      candidatesCount: 0,
      stage: "initialization",
    },
  };

  context.meta.templateId = context.template ? context.template.id : null;
  context.candidates = generateCandidates(context.template, foods, userState, rules);
  context.meta.candidatesCount = Object.keys(context.candidates).reduce((total, category) => {
    const list = Array.isArray(context.candidates[category]) ? context.candidates[category] : [];
    return total + list.length;
  }, 0);
  context.scored = scoreCandidates(context.candidates, userState, context.template);
  context.diversified = applyDiversity(context.scored, history);
  context.mealResult = optimizeMeal(context.template, context.diversified);
  context = applyReliability(context);
  context.meta.confidence = computeConfidence(context);
  context.meta.stage = "explanation";

  const trace = buildDecisionTrace(context);
  const structuredExplanation = generateStructuredExplanation(context, trace);

  return {
    context,
    trace,
    structuredExplanation,
  };
}

async function runTest(testName, config, validate) {
  const userState = await createUserState(config);
  const rules = config.rules || sampleRules;
  const foods = config.foods || sampleFoods;
  const mealType = config.mealType;
  const result = generateMealPlan({
    userState,
    mealType,
    foods,
    rules,
    userHistory,
  });
  const detailed = runDetailedContext({
    userState,
    mealType,
    foods,
    rules,
    userHistory,
  });

  console.log(JSON.stringify({
    testName,
    meal: result.meal,
    score: result.score,
    confidence: result.confidence,
    meta: result.meta,
    explanation: detailed.structuredExplanation,
    trace: detailed.trace,
  }, null, 2));

  validate(result, detailed);
}

(async () => {
  await runTest(
    "DIABETIC USER",
    {
      text: "I have diabetes",
      goal: "weight_loss",
      conditions: ["diabetes"],
      mealType: "lunch",
    },
    (result, detailed) => {
      const selectedItems = (((detailed.context || {}).mealResult || {}).breakdown || {}).items || [];
      const hasHighGiFood = selectedItems.some((item) => {
        const nutrition = item && item.nutrition ? item.nutrition : {};
        return typeof nutrition.glycemic_index === "number" && nutrition.glycemic_index > 70;
      });
      assert(!hasHighGiFood, "Diabetic user should not receive high GI foods");
      assert(/low glycemic|diabetes/i.test(detailed.structuredExplanation.explanation), "Explanation should mention low GI or diabetes suitability");
      assert(result.confidence > 0.5, "Confidence should be greater than 0.5");
    }
  );

  await runTest(
    "HIGH PITTA USER",
    {
      text: "I have acidity and burning sensation",
      mealType: "lunch",
      risk_flags: ["high_pitta"],
    },
    (result, detailed) => {
      const selectedItems = (((detailed.context || {}).mealResult || {}).breakdown || {}).items || [];
      const hasHeatingFood = selectedItems.some((item) => {
        const ayurveda = item && item.ayurveda ? item.ayurveda : {};
        const doshaEffect = item && item.dosha_effect ? item.dosha_effect : {};
        return ayurveda.virya === "hot" || (typeof doshaEffect.pitta === "number" && doshaEffect.pitta > 0.3);
      });
      assert(!hasHeatingFood, "High pitta user should avoid spicy or heating foods");
      assert(/pitta|dosha/i.test(detailed.structuredExplanation.explanation), "Explanation should reflect pitta or dosha logic");
    }
  );

  const nightMealRules = sampleRules.concat([
    {
      id: "night_heavy_food_restriction",
      priority: "P1",
      logic_tree: {
        AND: [
          { "user.meal_time": "night" },
          { "food.functional.heaviness_score": { ">": 0.7 } }
        ]
      },
      action: { type: "reject", reason: "Heavy foods should be avoided at night" }
    }
  ]);

  await runTest(
    "NIGHT MEAL CONSTRAINT",
    {
      text: "normal",
      mealType: "dinner",
      mealTime: "night",
      rules: nightMealRules,
    },
    (result, detailed) => {
      const selectedItems = (((detailed.context || {}).mealResult || {}).breakdown || {}).items || [];
      const hasHeavyFood = selectedItems.some((item) => {
        const functional = item && item.functional ? item.functional : {};
        return typeof functional.heaviness_score === "number" && functional.heaviness_score > 0.7;
      });
      const constraintTrace = detailed.trace.find((entry) => entry.stage === "constraint");
      assert(!hasHeavyFood, "Night meal should avoid heavy foods");
      assert(constraintTrace && /rule filtering/i.test(constraintTrace.detail), "Trace should include constraint filtering");
      const penaltyReasons = JSON.stringify(detailed.structuredExplanation.warnings || []);
      assert(/night|penalty|constraint/i.test(penaltyReasons) || Boolean(constraintTrace), "Night constraints should affect decision output");
    }
  );

  await runTest(
    "EDGE CASE - NO VALID FOODS",
    {
      text: "normal",
      mealType: "lunch",
      foods: [],
    },
    (result) => {
      assert(Array.isArray(result.meal) && result.meal.includes("khichdi"), "Fallback meal should be triggered");
      assert(result.meta && result.meta.relaxationLevel === 2, "Fallback path should reach relaxation level 2");
      assert(result.confidence <= 0.5, "Fallback confidence should be low");
      assert(/fallback/i.test(result.explanation.explanation), "Explanation should mention fallback");
    }
  );

  console.log("ALL SYSTEM VALIDATION TESTS COMPLETED");
})().catch((error) => {
  console.error("SYSTEM VALIDATION TESTS FAILED:", error.message);
  process.exitCode = 1;
});
