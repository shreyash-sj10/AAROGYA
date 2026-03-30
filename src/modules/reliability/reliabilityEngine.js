const { getBestTemplate } = require("../templates/mealTemplate.service");
const { generateCandidates } = require("../candidate/candidateGenerator");
const { scoreCandidates } = require("../scoring/scoringEngine");
const { applyDiversity } = require("../diversity/diversityEngine");
const { optimizeMeal } = require("../optimizer/optimizer");
const { generateExplanation } = require("../explanation/explanationEngine");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampConfidence(value) {
  return Math.max(0.1, Math.min(1, value));
}

function countCandidates(candidates) {
  const safeCandidates = toSafeObject(candidates);

  return Object.keys(safeCandidates).reduce((total, category) => {
    return total + toSafeArray(safeCandidates[category]).length;
  }, 0);
}

function isLowQualityMeal(mealResult) {
  const safeMealResult = toSafeObject(mealResult);
  const meal = toSafeArray(safeMealResult.meal);
  const score = toSafeNumber(safeMealResult.score, 0);

  return meal.length === 0 || score < 0.3;
}

function getContextInput(context) {
  const safeContext = toSafeObject(context);
  const input = toSafeObject(safeContext.input);

  return {
    userState: toSafeObject(safeContext.userState || input.userState),
    mealType: typeof (safeContext.mealType || input.mealType) === "string"
      ? (safeContext.mealType || input.mealType).trim()
      : "",
    foods: toSafeArray(safeContext.foods || input.foods),
    rules: toSafeArray(safeContext.rules || input.rules),
    userHistory: toSafeObject(safeContext.userHistory || input.userHistory),
  };
}

function cloneMeta(meta) {
  return { ...toSafeObject(meta) };
}

function cloneContext(context) {
  const safeContext = toSafeObject(context);

  return {
    ...safeContext,
    input: toSafeObject(safeContext.input),
    meta: cloneMeta(safeContext.meta),
  };
}

function relaxConstraints(rules, level) {
  const safeRules = toSafeArray(rules);

  if (level <= 0) {
    return safeRules.slice();
  }

  if (level === 1) {
    return safeRules.filter((rule) => toSafeObject(rule).priority !== "P3");
  }

  return safeRules.filter((rule) => {
    const priority = toSafeObject(rule).priority;
    return priority !== "P2" && priority !== "P3";
  });
}

function runPipelinePass(baseContext, activeRules, relaxationLevel) {
  const context = cloneContext(baseContext);
  const input = getContextInput(context);
  const template = getBestTemplate(input.mealType);

  if (!template) {
    throw new Error(`No template found for meal type \"${input.mealType}\".`);
  }

  context.template = template;
  context.rules = activeRules.slice();
  context.candidates = generateCandidates(template, input.foods, input.userState, activeRules);
  context.scored = scoreCandidates(context.candidates, input.userState, template);
  context.diversified = applyDiversity(context.scored, input.userHistory);
  context.mealResult = optimizeMeal(template, context.diversified);
  context.explanation = generateExplanation(context.mealResult, input.userState);
  context.meta = {
    ...context.meta,
    templateId: template.id,
    candidatesCount: countCandidates(context.candidates),
    relaxationLevel,
  };

  return context;
}

function computeConfidence(context) {
  const safeContext = toSafeObject(context);
  const mealResult = toSafeObject(safeContext.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  const mealMeta = toSafeObject(breakdown.meta);
  const contextMeta = toSafeObject(safeContext.meta);
  const totalPenalty = toSafeNumber(mealMeta.totalPenalty, 0);
  const totalDiversityPenalty = toSafeNumber(mealMeta.totalDiversityPenalty, 0);
  const relaxationLevel = toSafeNumber(contextMeta.relaxationLevel, 0);
  const confidence = 1 - (totalPenalty * 0.3) - (totalDiversityPenalty * 0.2) - (relaxationLevel * 0.3);

  return Number(clampConfidence(confidence).toFixed(3));
}

function buildFallbackContext(baseContext) {
  const context = cloneContext(baseContext);
  const input = getContextInput(context);
  const template = input.mealType ? getBestTemplate(input.mealType) : null;

  context.template = template;
  context.candidates = {};
  context.scored = {};
  context.diversified = {};
  context.mealResult = {
    meal: ["khichdi"],
    score: 0,
    breakdown: {
      items: [],
      totalScore: 0,
      meta: { fallback: true },
    },
  };
  context.explanation = {
    explanation: "System could not generate a suitable meal under current constraints. A safe fallback meal was returned.",
    highlights: ["Fallback meal selected for reliability."],
    warnings: ["Constraint relaxation was insufficient to produce a valid meal."],
  };
  context.meta = {
    ...context.meta,
    templateId: template && typeof template.id === "string" ? template.id : null,
    candidatesCount: 0,
    fallback: true,
    relaxationLevel: 2,
  };

  return context;
}

function applyReliability(context) {
  const baseContext = cloneContext(context);
  const input = getContextInput(baseContext);
  const baseRules = toSafeArray(baseContext.rules || input.rules);
  const strictContext = runPipelinePass(baseContext, baseRules, 0);

  if (!isLowQualityMeal(strictContext.mealResult)) {
    strictContext.meta.confidence = computeConfidence(strictContext);
    return strictContext;
  }

  for (let level = 1; level <= 2; level += 1) {
    const relaxedRules = relaxConstraints(baseRules, level);
    const relaxedContext = runPipelinePass(baseContext, relaxedRules, level);

    if (!isLowQualityMeal(relaxedContext.mealResult)) {
      relaxedContext.meta.confidence = computeConfidence(relaxedContext);
      return relaxedContext;
    }
  }

  const fallbackContext = buildFallbackContext(baseContext);
  fallbackContext.meta.confidence = computeConfidence(fallbackContext);
  return fallbackContext;
}

module.exports = {
  applyReliability,
  computeConfidence,
  isLowQualityMeal,
  relaxConstraints,
};
