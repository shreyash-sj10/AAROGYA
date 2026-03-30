const { getBestTemplate } = require("../modules/templates/mealTemplate.service");
const { generateCandidates } = require("../modules/candidate/candidateGenerator");
const { scoreCandidates } = require("../modules/scoring/scoringEngine");
const { applyDiversity } = require("../modules/diversity/diversityEngine");
const { optimizeMeal } = require("../modules/optimizer/optimizer");
const { generateExplanation } = require("../modules/explanation/explanationEngine");
const { applyReliability, computeConfidence } = require("../modules/reliability/reliabilityEngine");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countCandidates(candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};

  return Object.keys(safeCandidates).reduce((total, category) => total + toSafeArray(safeCandidates[category]).length, 0);
}

function generateMealPlan(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const userState = safeInput.userState && typeof safeInput.userState === "object" ? safeInput.userState : {};
  const mealType = typeof safeInput.mealType === "string" ? safeInput.mealType.trim() : "";
  const foods = toSafeArray(safeInput.foods);
  const rules = toSafeArray(safeInput.rules);
  const userHistory = safeInput.userHistory && typeof safeInput.userHistory === "object" ? safeInput.userHistory : {};
  let context = {
    input: { userState, mealType, foods, rules, userHistory },
    template: null,
    candidates: null,
    scored: null,
    diversified: null,
    mealResult: null,
    explanation: null,
    rules,
    foods,
    userHistory,
    meta: {
      templateId: null,
      candidatesCount: 0,
      stage: "initialization",
    },
  };

  try {
    if (!mealType) {
      throw new Error("generateMealPlan requires a valid mealType.");
    }

    context.meta.stage = "template";
    context.template = getBestTemplate(mealType);

    if (!context.template) {
      throw new Error(`No template found for meal type \"${mealType}\".`);
    }

    context.meta.templateId = context.template.id;

    context.meta.stage = "candidate_generation";
    context.candidates = generateCandidates(
      context.template,
      foods,
      userState,
      rules
    );
    context.meta.candidatesCount = countCandidates(context.candidates);

    context.meta.stage = "scoring";
    context.scored = scoreCandidates(
      context.candidates,
      userState,
      context.template
    );

    context.meta.stage = "diversity";
    context.diversified = applyDiversity(
      context.scored,
      userHistory
    );

    context.meta.stage = "optimization";
    context.mealResult = optimizeMeal(
      context.template,
      context.diversified
    );

    context = applyReliability(context);
    const confidence = computeConfidence(context);

    context.meta = {
      ...(context.meta && typeof context.meta === "object" ? context.meta : {}),
      stage: "explanation",
    };

    context.explanation = context.explanation || generateExplanation(
      context.mealResult,
      userState
    );

    return {
      ...context.mealResult,
      explanation: context.explanation,
      confidence,
      meta: {
        templateId: context.meta.templateId,
        totalPenalty: context.mealResult && context.mealResult.breakdown && context.mealResult.breakdown.meta
          ? context.mealResult.breakdown.meta.totalPenalty || 0
          : 0,
        totalDiversityPenalty: context.mealResult && context.mealResult.breakdown && context.mealResult.breakdown.meta
          ? context.mealResult.breakdown.meta.totalDiversityPenalty || 0
          : 0,
        relaxationLevel: context.meta.relaxationLevel || 0,
        stage: context.meta.stage,
        confidence,
      },
    };
  } catch (error) {
    return {
      meal: [],
      score: 0,
      explanation: {
        explanation: "System could not generate a meal.",
        highlights: [],
        warnings: ["Internal error occurred"],
      },
      meta: {
        error: error instanceof Error ? error.message : "Unknown error",
        stage: context.meta.stage,
      },
    };
  }
}

module.exports = {
  generateMealPlan,
};
