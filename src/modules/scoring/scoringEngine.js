const { SCORING_CONFIG } = require("../../config/scoring");
const { getNormalizedGoal, normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getPrimaryGoal(userState) {
  const normalizedGoal = normalizeString(userState && userState.goal);

  if (SCORING_CONFIG.GOALS.includes(normalizedGoal)) {
    return normalizedGoal;
  }

  return getNormalizedGoal(userState);
}

function getDigestibilityValue(food) {
  if (food && food.functional && typeof food.functional.digestibility_score === "number" && Number.isFinite(food.functional.digestibility_score)) {
    return food.functional.digestibility_score;
  }

  if (food && typeof food.digestibility_score === "number" && Number.isFinite(food.digestibility_score)) {
    return food.digestibility_score;
  }

  return SCORING_CONFIG.DEFAULTS.digestibility;
}

function computeNutritionScore(food, userState) {
  const nutrition = food && food.nutrition && typeof food.nutrition === "object" ? food.nutrition : {};
  const conditions = toSafeArray(userState && userState.conditions).map(normalizeString);
  const primaryGoal = getPrimaryGoal(userState);
  let score = SCORING_CONFIG.DEFAULTS.nutrition;

  if (conditions.includes("diabetes")) {
    const glycemicIndex = clamp01(
      toSafeNumber(nutrition.glycemic_index, SCORING_CONFIG.NORMALIZATION.MAX_GLYCEMIC_INDEX)
      / SCORING_CONFIG.NORMALIZATION.MAX_GLYCEMIC_INDEX
    );
    score = 1 - glycemicIndex;
  }

  if (primaryGoal === "muscle_gain") {
    const proteinScore = clamp01(toSafeNumber(nutrition.protein, 0) / SCORING_CONFIG.NORMALIZATION.MAX_PROTEIN);
    score = clamp01((score * 0.6) + (proteinScore * 0.4));
  }

  return Number(clamp01(score).toFixed(3));
}

function computeDoshaScore(food, userState) {
  const doshaEffect = food && food.dosha_effect && typeof food.dosha_effect === "object" ? food.dosha_effect : {};
  const riskFlags = toSafeArray(userState && userState.risk_flags).map(normalizeString);
  let score = SCORING_CONFIG.DEFAULTS.dosha;
  let matched = false;

  if (riskFlags.includes("high_pitta")) {
    score += -toSafeNumber(doshaEffect.pitta, 0);
    matched = true;
  }

  if (riskFlags.includes("high_vata")) {
    score += -toSafeNumber(doshaEffect.vata, 0);
    matched = true;
  }

  if (riskFlags.includes("high_kapha")) {
    score += -toSafeNumber(doshaEffect.kapha, 0);
    matched = true;
  }

  if (!matched) {
    return Number(SCORING_CONFIG.DEFAULTS.dosha.toFixed(3));
  }

  return Number(clamp01(score).toFixed(3));
}

function computeDigestibilityScore(food) {
  return Number(clamp01(getDigestibilityValue(food)).toFixed(3));
}

function computeFamiliarityScore(food, template) {
  const category = normalizeString(food && food.category);
  const components = template && Array.isArray(template.components) ? template.components : [];
  const hasCategory = components.some(
    (component) => component && component.type === "flexible" && normalizeString(component.category) === category
  );

  return hasCategory ? SCORING_CONFIG.WEIGHTS.familiarity : 0;
}

function computePenalty(food) {
  const evaluation = food && food.evaluation && typeof food.evaluation === "object" ? food.evaluation : {};
  return Number(clamp01(toSafeNumber(evaluation.totalPenalty, SCORING_CONFIG.DEFAULTS.penalty)).toFixed(3));
}

function compareScoredFoods(leftFood, rightFood) {
  if (rightFood.finalScore !== leftFood.finalScore) {
    return rightFood.finalScore - leftFood.finalScore;
  }

  const leftPenalty = leftFood && leftFood.breakdown ? toSafeNumber(leftFood.breakdown.penalty, 0) : 0;
  const rightPenalty = rightFood && rightFood.breakdown ? toSafeNumber(rightFood.breakdown.penalty, 0) : 0;

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  const leftName = typeof leftFood.name === "string" ? leftFood.name : "";
  const rightName = typeof rightFood.name === "string" ? rightFood.name : "";
  return leftName.localeCompare(rightName);
}

function scoreCandidate(food, userState, template) {
  const nutrition = computeNutritionScore(food, userState);
  const dosha = computeDoshaScore(food, userState);
  const digestibility = computeDigestibilityScore(food);
  const familiarity = computeFamiliarityScore(food, template);
  const penalty = computePenalty(food);
  const rawScore = (
    (SCORING_CONFIG.WEIGHTS.nutrition * nutrition)
    + (SCORING_CONFIG.WEIGHTS.dosha * dosha)
    + (SCORING_CONFIG.WEIGHTS.digestibility * digestibility)
    + familiarity
    - penalty
  );
  const score = Number(clamp01(rawScore).toFixed(3));

  return {
    ...food,
    digestibility_score: Number(getDigestibilityValue(food).toFixed(3)),
    evaluation: food && food.evaluation ? {
      ...food.evaluation,
      triggeredRules: toSafeArray(food.evaluation.triggeredRules).map((rule) => ({ ...rule })),
    } : {
      isValid: true,
      totalPenalty: 0,
      triggeredRules: [],
    },
    score,
    finalScore: score,
    breakdown: {
      nutrition,
      dosha,
      digestibility,
      familiarity,
      penalty,
    },
  };
}

function scoreCandidates(candidates, userState, template) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};

  return Object.keys(safeCandidates).reduce((scoredMap, category) => {
    const categoryCandidates = toSafeArray(safeCandidates[category]);

    scoredMap[category] = categoryCandidates
      .map((food) => scoreCandidate(food, userState, template))
      .sort(compareScoredFoods);

    return scoredMap;
  }, {});
}

module.exports = {
  computeDigestibilityScore,
  computeDoshaScore,
  computeFamiliarityScore,
  computeNutritionScore,
  scoreCandidates,
};
