const ADAPTIVE_CONFIG = require("../../config/adaptive");
const { deriveSignalFromFeedback } = require("./signal.engine");
const { updateWeights } = require("./weight.update");
const { getUserWeights, saveUserWeights } = require("./userPreference.repository");
const { parseFeedback, parseFeedbackSync } = require("./feedback.parser");
const { logLLMFallback, logLLMValidation } = require("../../observability/llm.logger");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function extractMealFeatures(meal) {
  const safeMeal = toSafeObject(meal);
  const direct = toSafeObject(safeMeal.features);

  if (Object.keys(direct).length > 0) {
    return {
      nutrition_score: toSafeNumber(direct.nutrition_score, 0.5),
      dosha_score: toSafeNumber(direct.dosha_score, 0.5),
      digestibility_score: toSafeNumber(direct.digestibility_score, 0.5),
      familiarity_score: toSafeNumber(direct.familiarity_score, 0.5),
    };
  }

  const items = toSafeArray(toSafeObject(safeMeal.breakdown).items);

  if (items.length === 0) {
    return {
      nutrition_score: 0.5,
      dosha_score: 0.5,
      digestibility_score: 0.5,
      familiarity_score: 0.5,
    };
  }

  const totals = items.reduce((acc, item) => {
    const breakdown = toSafeObject(toSafeObject(item).breakdown);
    acc.nutrition_score += toSafeNumber(breakdown.nutrition, 0.5);
    acc.dosha_score += toSafeNumber(breakdown.dosha, 0.5);
    acc.digestibility_score += toSafeNumber(breakdown.digestibility, 0.5);
    acc.familiarity_score += toSafeNumber(breakdown.familiarity, 0.5);
    return acc;
  }, {
    nutrition_score: 0,
    dosha_score: 0,
    digestibility_score: 0,
    familiarity_score: 0,
  });

  const divisor = items.length || 1;

  return {
    nutrition_score: totals.nutrition_score / divisor,
    dosha_score: totals.dosha_score / divisor,
    digestibility_score: totals.digestibility_score / divisor,
    familiarity_score: totals.familiarity_score / divisor,
  };
}

function applyParsedFeedback(user_id, parsed, meal) {
  const modeRaw = typeof parsed.feedback_type === "string" ? parsed.feedback_type.trim().toUpperCase() : "";
  const mode = modeRaw === "REPLACE" ? "DISLIKE" : modeRaw;

  if (mode !== "LIKE" && mode !== "DISLIKE" && mode !== "SKIP") {
    return getUserWeights(user_id);
  }

  const mealFeatures = extractMealFeatures(meal);
  const signal = deriveSignalFromFeedback(mode, mealFeatures);
  const current = getUserWeights(user_id);
  const updated = updateWeights(current, signal, ADAPTIVE_CONFIG.alpha);

  return saveUserWeights(user_id, updated);
}

function processFeedback(user_id, feedback, meal) {
  const parsed = typeof feedback === "string"
    ? parseFeedbackSync(feedback)
    : (feedback && typeof feedback === "object" ? feedback : {});

  return applyParsedFeedback(user_id, parsed, meal);
}

async function processFeedbackAsync(user_id, feedback, meal) {
  try {
    const parsed = typeof feedback === "string"
      ? await parseFeedback(feedback)
      : (feedback && typeof feedback === "object" ? feedback : {});

    return applyParsedFeedback(user_id, parsed, meal);
  } catch (error) {
    logLLMFallback({ endpoint: "ai/feedback", request_id: "feedback_service", reason: "parse_feedback_failed" });
    return processFeedback(user_id, feedback, meal);
  }
}

module.exports = {
  extractMealFeatures,
  processFeedback,
  processFeedbackAsync,
};

