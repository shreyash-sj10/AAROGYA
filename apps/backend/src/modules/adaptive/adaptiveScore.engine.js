const { normalizeString, toSafeArray, toSafeNumber, toSafeObject } = require("../../utils/normalizeInput");

const ADAPTIVE_SCORE_CONFIG = {
  likeBoost: 0.12,
  dislikePenalty: 0.18,
  frequencyBoostPerHit: 0.01,
  frequencyBoostCap: 0.06,
  min: -0.25,
  max: 0.25,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeKey(value) {
  return normalizeString(typeof value === "string" ? value : "");
}

function extractFoodKeys(food) {
  const safeFood = toSafeObject(food);
  const keys = [
    normalizeKey(safeFood.recipe_id),
    normalizeKey(safeFood.id),
    normalizeKey(safeFood.name),
  ].filter(Boolean);
  return Array.from(new Set(keys));
}

function pushSignal(target, key, delta) {
  if (!key) {
    return;
  }

  target[key] = toSafeNumber(target[key], 0) + delta;
}

function buildAdaptiveSignals(userState) {
  const safeUserState = toSafeObject(userState);
  const behavior = toSafeObject(
    safeUserState.user_history
    || safeUserState.userHistory
    || safeUserState.behavior
  );
  const interactionLogs = toSafeArray(
    safeUserState.interaction_logs
    || safeUserState.interactionLogs
    || safeUserState.logs
  );

  const liked = {};
  const disliked = {};
  const selected = {};

  toSafeArray(behavior.liked_foods || behavior.likes)
    .map(normalizeKey)
    .filter(Boolean)
    .forEach((key) => pushSignal(liked, key, 1));

  toSafeArray(behavior.disliked_foods || behavior.dislikes)
    .map(normalizeKey)
    .filter(Boolean)
    .forEach((key) => pushSignal(disliked, key, 1));

  const selectedCounts = toSafeObject(behavior.selected_counts || behavior.selection_counts);
  Object.keys(selectedCounts).forEach((rawKey) => {
    pushSignal(selected, normalizeKey(rawKey), Math.max(0, toSafeNumber(selectedCounts[rawKey], 0)));
  });

  interactionLogs.forEach((entry) => {
    const safeEntry = toSafeObject(entry);
    const action = normalizeKey(safeEntry.action || safeEntry.event || safeEntry.feedback_type);
    const key = normalizeKey(
      safeEntry.food
      || safeEntry.recipe_id
      || safeEntry.recipeId
      || safeEntry.name
      || safeEntry.target
    );

    if (!key) {
      return;
    }

    if (action === "like" || action === "liked") {
      pushSignal(liked, key, 1);
      return;
    }

    if (action === "dislike" || action === "disliked" || action === "skip" || action === "replace") {
      pushSignal(disliked, key, 1);
      return;
    }

    if (action === "select" || action === "selected" || action === "choose" || action === "chosen") {
      pushSignal(selected, key, 1);
    }
  });

  return { liked, disliked, selected };
}

function keysMatch(signalKey, foodKeys) {
  if (!signalKey) {
    return false;
  }

  return foodKeys.some((foodKey) => {
    if (!foodKey) {
      return false;
    }
    return foodKey === signalKey || foodKey.includes(signalKey) || signalKey.includes(foodKey);
  });
}

function sumMatchingSignalCounts(signalMap, foodKeys) {
  const safeMap = toSafeObject(signalMap);
  return Object.keys(safeMap).reduce((total, key) => {
    if (!keysMatch(key, foodKeys)) {
      return total;
    }
    return total + Math.max(0, toSafeNumber(safeMap[key], 0));
  }, 0);
}

function computeAdaptiveScore(food, userState) {
  const keys = extractFoodKeys(food);

  if (keys.length === 0) {
    return 0;
  }

  const signals = buildAdaptiveSignals(userState);
  const dislikeCount = sumMatchingSignalCounts(signals.disliked, keys);
  const likeCount = sumMatchingSignalCounts(signals.liked, keys);
  const selectedCount = sumMatchingSignalCounts(signals.selected, keys);
  const hasDislike = dislikeCount > 0;
  const hasLike = likeCount > 0;

  let score = 0;
  if (hasDislike) {
    score -= ADAPTIVE_SCORE_CONFIG.dislikePenalty;
  }

  if (hasLike && !hasDislike) {
    score += ADAPTIVE_SCORE_CONFIG.likeBoost;
  }

  if (selectedCount > 0) {
    score += Math.min(
      ADAPTIVE_SCORE_CONFIG.frequencyBoostCap,
      selectedCount * ADAPTIVE_SCORE_CONFIG.frequencyBoostPerHit
    );
  }

  return Number(clamp(score, ADAPTIVE_SCORE_CONFIG.min, ADAPTIVE_SCORE_CONFIG.max).toFixed(3));
}

module.exports = {
  buildAdaptiveSignals,
  computeAdaptiveScore,
};