const { normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

function getSelectedFoods(mealResult) {
  const safeMealResult = mealResult && typeof mealResult === "object" ? mealResult : {};
  const breakdown = safeMealResult.breakdown && typeof safeMealResult.breakdown === "object"
    ? safeMealResult.breakdown
    : {};
  const detailedItems = toSafeArray(breakdown.items).filter((item) => item && typeof item === "object" && !Array.isArray(item));

  if (detailedItems.length > 0) {
    return detailedItems.map((item) => ({
      name: normalizeString(item.name),
      category: normalizeString(item.category),
      score: toSafeNumber(item.score, 0),
      finalScore: toSafeNumber(item.finalScore, toSafeNumber(item.score, 0)),
      breakdown: item.breakdown && typeof item.breakdown === "object" ? { ...item.breakdown } : {},
      evaluation: item.evaluation && typeof item.evaluation === "object"
        ? {
          ...item.evaluation,
          triggeredRules: toSafeArray(item.evaluation.triggeredRules).map((rule) => ({ ...rule })),
        }
        : {},
      diversityPenalty: toSafeNumber(item.diversityPenalty, 0),
    }));
  }

  return toSafeArray(safeMealResult.meal)
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .map((name) => ({
      name,
      category: "",
      score: 0,
      finalScore: 0,
      breakdown: {},
      evaluation: {},
      diversityPenalty: 0,
    }));
}

function getTriggeredRules(selectedFoods) {
  return selectedFoods.reduce((rules, food) => {
    const triggeredRules = toSafeArray(food && food.evaluation && food.evaluation.triggeredRules)
      .filter((rule) => rule && typeof rule === "object")
      .map((rule) => ({
        reason: normalizeString(rule.reason),
        action: normalizeString(rule.action),
      }));

    return rules.concat(triggeredRules);
  }, []);
}

function getFoodReasons(food) {
  const reasons = [];
  const breakdown = food && food.breakdown && typeof food.breakdown === "object" ? food.breakdown : {};

  if (toSafeNumber(breakdown.nutrition, 0) >= 0.6) {
    reasons.push("strong nutrition alignment");
  }

  if (toSafeNumber(breakdown.digestibility, 0) >= 0.6) {
    reasons.push("easy digestion");
  }

  if (toSafeNumber(breakdown.dosha, 0) >= 0.6) {
    reasons.push("good dosha compatibility");
  }

  if (toSafeNumber(breakdown.familiarity, 0) > 0) {
    reasons.push("template fit");
  }

  return reasons.slice(0, 2);
}

function buildExplanationInput(mealResult, userState) {
  const safeMealResult = mealResult && typeof mealResult === "object" ? mealResult : {};
  const breakdown = safeMealResult.breakdown && typeof safeMealResult.breakdown === "object"
    ? safeMealResult.breakdown
    : {};
  const meta = breakdown.meta && typeof breakdown.meta === "object" ? breakdown.meta : {};
  const selectedFoods = getSelectedFoods(safeMealResult);
  const userConditions = toSafeArray(userState && userState.conditions)
    .map((condition) => normalizeString(condition))
    .filter(Boolean);
  const triggeredRules = getTriggeredRules(selectedFoods);
  const penaltyFoods = selectedFoods.filter(
    (food) => food.breakdown && toSafeNumber(food.breakdown.penalty, 0) > 0
  );

  return {
    selectedFoods,
    userConditions,
    triggeredRules,
    penaltyFoods,
    totalScore: toSafeNumber(breakdown.totalScore, toSafeNumber(safeMealResult.score, 0)),
    meta: {
      totalPenalty: toSafeNumber(meta.totalPenalty, 0),
      totalDiversityPenalty: toSafeNumber(meta.totalDiversityPenalty, 0),
      combinationCount: toSafeNumber(meta.combinationCount, 0),
      flexibleCategories: toSafeArray(meta.flexibleCategories),
      fixedItems: toSafeArray(meta.fixedItems),
      categoriesUsed: toSafeArray(meta.categoriesUsed),
    },
  };
}

function formatHighlights(explanationInput) {
  const highlights = [];

  explanationInput.selectedFoods.forEach((food) => {
    const reasons = getFoodReasons(food);

    if (food.name && reasons.length > 0) {
      highlights.push(`${food.name} was selected for ${reasons.join(" and ")}.`);
    }
  });

  if (explanationInput.userConditions.includes("diabetes") && explanationInput.selectedFoods.some(
    (food) => toSafeNumber(food.breakdown && food.breakdown.nutrition, 0) >= 0.6
  )) {
    highlights.push("Low glycemic alignment improved suitability for diabetes.");
  }

  return Array.from(new Set(highlights));
}

function formatWarnings(explanationInput) {
  const warnings = [];

  if (explanationInput.penaltyFoods.length > 0) {
    const reasons = explanationInput.triggeredRules
      .map((rule) => rule.reason)
      .filter(Boolean);

    if (reasons.length > 0) {
      warnings.push(`Penalty signals remained for: ${Array.from(new Set(reasons)).join("; ")}.`);
    } else {
      warnings.push("Some selected foods carry mild penalty signals.");
    }
  }

  if (explanationInput.meta.totalDiversityPenalty > 0) {
    warnings.push("Recent food repetition was penalized to improve variety.");
  }

  return warnings;
}

function generateExplanation(mealResult, userState) {
  const explanationInput = buildExplanationInput(mealResult, userState);
  const highlights = formatHighlights(explanationInput);
  const warnings = formatWarnings(explanationInput);
  const mealNames = toSafeArray(mealResult && mealResult.meal).filter((item) => typeof item === "string" && item.trim().length > 0);
  const mealLabel = mealNames.length > 0 ? mealNames.join(", ") : "khichdi";
  const parts = [`Selected meal: ${mealLabel}.`];

  if (highlights.length > 0) {
    parts.push(`Selection reasons: ${highlights.join(" ")}`);
  }

  if (warnings.length > 0) {
    parts.push(`Watch-outs: ${warnings.join(" ")}`);
  }

  return {
    explanation: parts.join(" "),
    highlights,
    warnings,
  };
}

module.exports = {
  buildExplanationInput,
  formatHighlights,
  formatWarnings,
  generateExplanation,
};
