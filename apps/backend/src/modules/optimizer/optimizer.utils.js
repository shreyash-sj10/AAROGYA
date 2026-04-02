function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function computeCombinationScore(items) {
  const safeItems = toSafeArray(items);

  const totals = safeItems.reduce((acc, item) => {
    const safeItem = toSafeObject(item);

    acc.totalScore += toSafeNumber(safeItem.score, 0);
    acc.totalPenalty += toSafeNumber(safeItem.penalty, 0);

    return acc;
  }, {
    totalScore: 0,
    totalPenalty: 0,
  });

  return {
    totalScore: Number(totals.totalScore.toFixed(6)),
    totalPenalty: Number(totals.totalPenalty.toFixed(6)),
  };
}

module.exports = {
  computeCombinationScore,
};
