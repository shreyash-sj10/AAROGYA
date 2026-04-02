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
  return toSafeNumber(safeCandidate.score, 0);
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

function getCandidateId(candidate) {
  const safeCandidate = toSafeObject(candidate);

  if (typeof safeCandidate.recipe_id === "string") {
    return safeCandidate.recipe_id;
  }

  if (typeof safeCandidate.id === "string") {
    return safeCandidate.id;
  }

  return toSafeString(safeCandidate.name, "");
}

function sanitizeCandidate(candidate) {
  const safeCandidate = toSafeObject(candidate);

  return {
    ...safeCandidate,
    score: getCandidateScore(safeCandidate),
    penalty: getCandidatePenalty(safeCandidate),
    recipe_id: getCandidateId(safeCandidate),
  };
}

function getCombinationLexicalKey(combination) {
  const safeCombination = toSafeObject(combination);
  const items = toSafeArray(safeCombination.items);

  return items
    .map((item) => getCandidateId(item))
    .join("|");
}

function compareCombinations(left, right) {
  const leftScore = toSafeNumber(toSafeObject(left).totalScore, 0);
  const rightScore = toSafeNumber(toSafeObject(right).totalScore, 0);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftPenalty = toSafeNumber(toSafeObject(left).totalPenalty, 0);
  const rightPenalty = toSafeNumber(toSafeObject(right).totalPenalty, 0);

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  return getCombinationLexicalKey(left).localeCompare(getCombinationLexicalKey(right));
}

function expandWithCandidate(combination, candidate) {
  const safeCombination = toSafeObject(combination);
  const safeItems = toSafeArray(safeCombination.items);
  const safeCandidate = sanitizeCandidate(candidate);
  const nextScore = toSafeNumber(safeCombination.totalScore, 0) + getCandidateScore(safeCandidate);
  const nextPenalty = toSafeNumber(safeCombination.totalPenalty, 0) + getCandidatePenalty(safeCandidate);

  return {
    items: [...safeItems, safeCandidate],
    totalScore: Number(nextScore.toFixed(6)),
    totalPenalty: Number(nextPenalty.toFixed(6)),
  };
}

function sortCandidates(candidates) {
  return [...toSafeArray(candidates)]
    .map(sanitizeCandidate)
    .sort((left, right) => {
      const scoreDiff = getCandidateScore(right) - getCandidateScore(left);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const penaltyDiff = getCandidatePenalty(left) - getCandidatePenalty(right);

      if (penaltyDiff !== 0) {
        return penaltyDiff;
      }

      return getCandidateId(left).localeCompare(getCandidateId(right));
    });
}

function runBeamSearch(candidatesByCategory, beamWidth) {
  const safeCandidatesByCategory = toSafeObject(candidatesByCategory);
  const categories = Object.keys(safeCandidatesByCategory).sort((a, b) => a.localeCompare(b));
  const safeBeamWidth = Math.max(1, Math.floor(toSafeNumber(beamWidth, 1)));

  let beam = [{ items: [], totalScore: 0, totalPenalty: 0 }];

  for (const category of categories) {
    const categoryCandidates = sortCandidates(safeCandidatesByCategory[category]);

    if (categoryCandidates.length === 0) {
      // Skip empty category so caller can decide fallback policy.
      continue;
    }

    if (beam.length === 0) {
      return null;
    }

    if (categoryCandidates.length === 1) {
      const onlyCandidate = categoryCandidates[0];
      beam = beam.map((combination) => expandWithCandidate(combination, onlyCandidate));
      continue;
    }

    const newBeam = [];

    for (const combination of beam) {
      for (const candidate of categoryCandidates) {
        newBeam.push(expandWithCandidate(combination, candidate));
      }
    }

    beam = newBeam
      .sort(compareCombinations)
      .slice(0, safeBeamWidth);
  }

  if (beam.length === 0) {
    return null;
  }

  const best = beam[0];

  if (!best || !Array.isArray(best.items)) {
    return null;
  }

  if (categories.length > 0 && best.items.length === 0) {
    return null;
  }

  return {
    items: best.items.map((item) => sanitizeCandidate(item)),
    totalScore: Number(toSafeNumber(best.totalScore, 0).toFixed(6)),
    totalPenalty: Number(toSafeNumber(best.totalPenalty, 0).toFixed(6)),
  };
}

module.exports = {
  runBeamSearch,
};

