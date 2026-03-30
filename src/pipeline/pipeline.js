const { normalizeUserHistory, normalizeUserState, toSafeArray } = require("../utils/normalizeInput");
const { extractCategories, getBestTemplate } = require("../modules/templates/mealTemplate.service");
const { generateCandidates } = require("../modules/candidate/candidateGenerator");
const { scoreCandidates } = require("../modules/scoring/scoringEngine");
const { applyDiversity } = require("../modules/diversity/diversityEngine");
const { optimizeMeal } = require("../modules/optimizer/optimizer");
const { generateExplanation } = require("../modules/explanation/explanationEngine");

function countCandidates(candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};

  return Object.keys(safeCandidates).reduce((total, category) => total + toSafeArray(safeCandidates[category]).length, 0);
}

function countRelevantFoods(foods, categories) {
  const relevantCategories = new Set(toSafeArray(categories));

  return toSafeArray(foods).filter((food) => food && relevantCategories.has(food.category)).length;
}

function createFallbackResult(template, explanation) {
  const templateId = template && typeof template.id === "string" ? template.id : null;

  return {
    meal: ["khichdi"],
    score: 0,
    reason: "fallback",
    breakdown: {
      items: [],
      totalScore: 0,
      meta: {
        templateId,
        totalPenalty: 0,
        totalDiversityPenalty: 0,
        categoriesUsed: [],
        reason: "fallback",
      },
    },
    explanation,
    meta: {
      templateId,
      totalPenalty: 0,
      totalDiversityPenalty: 0,
      categoriesUsed: [],
      reason: "fallback",
    },
  };
}

function runPipeline(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const normalizedUserState = normalizeUserState(safeInput.userState);
  const mealType = typeof safeInput.mealType === "string" ? safeInput.mealType.trim() : "";
  const foods = toSafeArray(safeInput.foods);
  const rules = toSafeArray(safeInput.rules);
  const normalizedUserHistory = normalizeUserHistory(safeInput.userHistory);

  if (!mealType) {
    throw new Error("runPipeline requires a valid mealType.");
  }

  try {
    const template = getBestTemplate(mealType);

    if (!template) {
      throw new Error(`No template found for meal type \"${mealType}\".`);
    }

    const categories = extractCategories(template);
    const candidates = generateCandidates(template, foods, normalizedUserState, rules);
    const scored = scoreCandidates(candidates, normalizedUserState, template);
    const diversified = applyDiversity(scored, normalizedUserHistory);
    const mealResult = optimizeMeal(template, diversified);

    if (!Array.isArray(mealResult.meal) || mealResult.meal.length === 0) {
      const fallbackExplanation = {
        explanation: "Fallback meal selected because no valid candidates were available.",
        highlights: [],
        warnings: ["Using fallback meal after candidate exhaustion."],
      };
      const fallbackResult = createFallbackResult(template, fallbackExplanation);

      console.log({
        template: template.id,
        candidatesCount: countCandidates(candidates),
        rejectedCount: Math.max(0, countRelevantFoods(foods, categories) - countCandidates(candidates)),
        selectedMeal: fallbackResult.meal,
        score: fallbackResult.score,
      });

      return fallbackResult;
    }

    const explanation = generateExplanation(mealResult, normalizedUserState);
    const totalPenalty = mealResult && mealResult.breakdown && mealResult.breakdown.meta
      ? mealResult.breakdown.meta.totalPenalty || 0
      : 0;
    const totalDiversityPenalty = mealResult && mealResult.breakdown && mealResult.breakdown.meta
      ? mealResult.breakdown.meta.totalDiversityPenalty || 0
      : 0;
    const categoriesUsed = mealResult && mealResult.breakdown && mealResult.breakdown.meta
      ? toSafeArray(mealResult.breakdown.meta.categoriesUsed)
      : [];
    const result = {
      meal: mealResult.meal,
      score: mealResult.score,
      breakdown: mealResult.breakdown,
      explanation,
      meta: {
        templateId: template.id,
        totalPenalty,
        totalDiversityPenalty,
        categoriesUsed,
      },
    };

    console.log({
      template: template.id,
      candidatesCount: countCandidates(candidates),
      rejectedCount: Math.max(0, countRelevantFoods(foods, categories) - countCandidates(candidates)),
      selectedMeal: result.meal,
      score: result.score,
    });

    return result;
  } catch (error) {
    const fallbackExplanation = {
      explanation: "Fallback meal selected because pipeline validation failed.",
      highlights: [],
      warnings: [error instanceof Error ? error.message : "Unknown pipeline failure."],
    };

    return createFallbackResult(null, fallbackExplanation);
  }
}

module.exports = {
  runPipeline,
};
