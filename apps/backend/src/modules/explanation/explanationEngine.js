const { normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

const { getExplanation } = require("../../services/ml/mlClient");
const { logLLMFallback } = require("../../observability/llm.logger");

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

function buildDeterministicExplanationText(mealResult, highlights, warnings, traceContext) {
  const mealNames = toSafeArray(mealResult && mealResult.meal).filter((item) => typeof item === "string" && item.trim().length > 0);
  const mealLabel = mealNames.length > 0 ? mealNames.join(", ") : "safe_unavailable";
  const parts = [`Selected meal: ${mealLabel}.`];
  const safeTrace = traceContext && typeof traceContext === "object" ? traceContext : {};

  if (highlights.length > 0) {
    parts.push(`Selection reasons: ${highlights.join(" ")}`);
  }

  if (warnings.length > 0) {
    parts.push(`Watch-outs: ${warnings.join(" ")}`);
  }

  if (safeTrace.relaxation_applied === true) {
    parts.push("Some dietary constraints were relaxed to ensure a valid and balanced recommendation. This adjustment remains within safe limits.");
  }

  return parts.join(" ");
}

function buildReasoningTrace(highlights, warnings, explanationInput) {
  const trace = [];

  if (highlights.length > 0) {
    trace.push(`highlights=${highlights.length}`);
  }

  if (warnings.length > 0) {
    trace.push(`warnings=${warnings.length}`);
  }

  if (toSafeNumber(explanationInput.meta.totalPenalty, 0) > 0) {
    trace.push(`totalPenalty=${toSafeNumber(explanationInput.meta.totalPenalty, 0)}`);
  }

  if (toSafeNumber(explanationInput.meta.totalDiversityPenalty, 0) > 0) {
    trace.push(`totalDiversityPenalty=${toSafeNumber(explanationInput.meta.totalDiversityPenalty, 0)}`);
  }

  return trace;
}

function buildAIPayload(mealResult, userState, highlights, warnings, explanationInput) {
  return {
    context: {
      risk_flags: toSafeArray(userState && userState.risk_flags),
      selected_recipes: toSafeArray(mealResult && mealResult.meal),
      user_conditions: toSafeArray(userState && userState.conditions),
      highlights,
      warnings,
    },
    reasoning: {
      trace: buildReasoningTrace(highlights, warnings, explanationInput),
      total_score: toSafeNumber(mealResult && mealResult.score, 0),
    },
  };
}

function generateExplanation(mealResult, userState, traceContext) {
  const explanationInput = buildExplanationInput(mealResult, userState);
  const highlights = formatHighlights(explanationInput);
  const warnings = formatWarnings(explanationInput);
  const deterministic = buildDeterministicExplanationText(mealResult, highlights, warnings, traceContext);

  return {
    deterministic,
    ai_explanation: "",
    citations: [],
    sources: [],
    explanation: deterministic,
    highlights,
    warnings,
  };
}

async function generateExplanationWithAI(mealResult, userState, traceContext) {
  const base = generateExplanation(mealResult, userState, traceContext);

  try {
    const explanationInput = buildExplanationInput(mealResult, userState);
    const highlights = formatHighlights(explanationInput);
    const warnings = formatWarnings(explanationInput);
    const aiPayload = buildAIPayload(mealResult, userState, highlights, warnings, explanationInput);
    const aiResult = await getExplanation(aiPayload);

    if (!aiResult || typeof aiResult.explanation !== "string" || !aiResult.explanation.trim()) {
      logLLMFallback({ endpoint: "ai/explain", request_id: "explanation_engine", reason: "empty_ai_explanation" });
      return base;
    }

    return {
      ...base,
      ai_explanation: aiResult.explanation,
      citations: Array.isArray(aiResult.citations) ? aiResult.citations : [],
      sources: Array.isArray(aiResult.citations)
        ? aiResult.citations
          .map((item) => (item && typeof item === "object" && typeof item.text_id === "string" ? item.text_id : ""))
          .filter(Boolean)
        : [],
    };
  } catch (error) {
    logLLMFallback({ endpoint: "ai/explain", request_id: "explanation_engine", reason: "explanation_call_failed" });
    return base;
  }
}

module.exports = {
  buildExplanationInput,
  formatHighlights,
  formatWarnings,
  generateExplanation,
  generateExplanationWithAI,
};

