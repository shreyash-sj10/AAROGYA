function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toSafeString(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function getCandidateScore(candidate) {
  const safeCandidate = toSafeObject(candidate);
  return toSafeNumber(safeCandidate.finalScore, toSafeNumber(safeCandidate.score, 0));
}

function getCandidatePenalty(candidate) {
  const safeCandidate = toSafeObject(candidate);
  const safeEvaluation = toSafeObject(safeCandidate.evaluation);
  const safeBreakdown = toSafeObject(safeCandidate.breakdown);

  if (Number.isFinite(safeEvaluation.totalPenalty)) {
    return safeEvaluation.totalPenalty;
  }

  if (Number.isFinite(safeBreakdown.penalty)) {
    return safeBreakdown.penalty;
  }

  return 0;
}

function getCandidateRecipeId(candidate) {
  const safeCandidate = toSafeObject(candidate);

  if (typeof safeCandidate.recipe_id === "string") {
    return safeCandidate.recipe_id;
  }

  if (typeof safeCandidate.id === "string") {
    return safeCandidate.id;
  }

  return toSafeString(safeCandidate.name, "");
}

function compareCandidates(left, right) {
  const leftScore = getCandidateScore(left);
  const rightScore = getCandidateScore(right);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftPenalty = getCandidatePenalty(left);
  const rightPenalty = getCandidatePenalty(right);

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  const leftRecipeId = getCandidateRecipeId(left);
  const rightRecipeId = getCandidateRecipeId(right);

  return leftRecipeId.localeCompare(rightRecipeId);
}

function buildGreedySolution(candidatesByCategory) {
  const safeCandidatesByCategory = toSafeObject(candidatesByCategory);
  const categories = Object.keys(safeCandidatesByCategory).sort((a, b) => a.localeCompare(b));

  const items = categories.reduce((selectedItems, category) => {
    const candidates = toSafeArray(safeCandidatesByCategory[category]);

    if (candidates.length === 0) {
      return selectedItems;
    }

    const winner = candidates.reduce((best, cur) => (compareCandidates(best, cur) > 0 ? cur : best));

    if (winner && typeof winner === "object") {
      selectedItems.push({ ...winner });
    }

    return selectedItems;
  }, []);

  const totalScore = Number(items.reduce((sum, item) => sum + getCandidateScore(item), 0).toFixed(6));
  const totalPenalty = Number(items.reduce((sum, item) => sum + getCandidatePenalty(item), 0).toFixed(6));

  return {
    items,
    totalScore,
    totalPenalty,
  };
}

module.exports = {
  buildGreedySolution,
};
