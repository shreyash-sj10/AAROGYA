function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function countCandidates(candidates) {
  const safeCandidates = toSafeObject(candidates);

  return Object.keys(safeCandidates).reduce((total, category) => {
    return total + toSafeArray(safeCandidates[category]).length;
  }, 0);
}

function countRelevantFoods(context) {
  const safeContext = toSafeObject(context);
  const foods = toSafeArray(safeContext.foods || (safeContext.input && safeContext.input.foods));
  const candidates = toSafeObject(safeContext.candidates);
  const candidateCategories = Object.keys(candidates);

  if (candidateCategories.length === 0) {
    return 0;
  }

  const relevantCategories = new Set(candidateCategories);
  return foods.filter((food) => food && relevantCategories.has(food.category)).length;
}

function getTotalPenalty(context) {
  const mealResult = toSafeObject(context && context.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  const meta = toSafeObject(breakdown.meta);

  return toSafeNumber(meta.totalPenalty, 0);
}

function getTotalDiversityPenalty(context) {
  const mealResult = toSafeObject(context && context.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  const meta = toSafeObject(breakdown.meta);

  return toSafeNumber(meta.totalDiversityPenalty, 0);
}

function getTotalScore(context) {
  const mealResult = toSafeObject(context && context.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  return toSafeNumber(breakdown.totalScore, toSafeNumber(mealResult.score, 0));
}

function getCombinationCount(context) {
  const mealResult = toSafeObject(context && context.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  const meta = toSafeObject(breakdown.meta);
  return toSafeNumber(meta.combinationCount, 0);
}

function getSelectedItems(context) {
  const mealResult = toSafeObject(context && context.mealResult);
  const breakdown = toSafeObject(mealResult.breakdown);
  return toSafeArray(breakdown.items).filter((item) => item && typeof item === "object");
}

function getPenaltyReasons(items) {
  return items.reduce((reasons, item) => {
    const evaluation = toSafeObject(item && item.evaluation);
    const triggeredRules = toSafeArray(evaluation.triggeredRules);

    triggeredRules.forEach((rule) => {
      const reason = normalizeString(rule && rule.reason);
      if (reason) {
        reasons.push(reason);
      }
    });

    return reasons;
  }, []);
}

function getConditionHighlights(items, context) {
  const safeContext = toSafeObject(context);
  const input = toSafeObject(safeContext.input);
  const userState = toSafeObject(safeContext.userState || input.userState);
  const conditions = toSafeArray(userState.conditions).map(normalizeString).filter(Boolean);
  const highlights = [];

  if (conditions.includes("diabetes") && items.some((item) => toSafeNumber(toSafeObject(item.breakdown).nutrition, 0) >= 0.6)) {
    highlights.push("Low glycemic scoring improved suitability for diabetes.");
  }

  if (toSafeArray(userState.risk_flags).map(normalizeString).includes("high_pitta") && items.some((item) => toSafeNumber(toSafeObject(item.breakdown).dosha, 0) >= 0.6)) {
    highlights.push("Dosha scoring favored foods better aligned with high pitta management.");
  }

  return highlights;
}

function getScoringHighlights(items) {
  const highlights = [];

  items.forEach((item) => {
    const name = normalizeString(item && item.name);
    const breakdown = toSafeObject(item && item.breakdown);

    if (name && toSafeNumber(breakdown.nutrition, 0) >= 0.6) {
      highlights.push(`${name} scored well on nutrition.`);
    }

    if (name && toSafeNumber(breakdown.digestibility, 0) >= 0.6) {
      highlights.push(`${name} scored well on digestibility.`);
    }
  });

  return highlights;
}

function getReliabilityMessage(context) {
  const meta = toSafeObject(context && context.meta);
  const relaxationLevel = toSafeNumber(meta.relaxationLevel, 0);
  const fallback = Boolean(meta.fallback);

  if (fallback) {
    return `Fallback status=true, relaxationLevel=${relaxationLevel}. Returned fallback meal after all relaxation levels were exhausted.`;
  }

  if (relaxationLevel > 0) {
    return `Fallback status=false, relaxationLevel=${relaxationLevel}. Reliability relaxation was applied.`;
  }

  return "Fallback status=false, relaxationLevel=0. Strict decision path succeeded without relaxation.";
}

function buildDecisionTrace(context) {
  const safeContext = toSafeObject(context);
  const template = toSafeObject(safeContext.template);
  const mealResult = toSafeObject(safeContext.mealResult);
  const selectedMeal = toSafeArray(mealResult.meal).filter((item) => typeof item === "string" && item.trim().length > 0);
  const candidatesCount = countCandidates(safeContext.candidates);
  const rejectedCount = Math.max(0, countRelevantFoods(safeContext) - candidatesCount);
  const totalPenalty = getTotalPenalty(safeContext);
  const totalDiversityPenalty = getTotalDiversityPenalty(safeContext);
  const totalScore = getTotalScore(safeContext);
  const combinationCount = getCombinationCount(safeContext);

  return [
    {
      stage: "template",
      detail: `Selected template: ${normalizeString(template.name) || normalizeString(template.id) || "unknown template"}`,
    },
    {
      stage: "candidate",
      detail: `Generated candidates: ${candidatesCount}; rejected: ${rejectedCount}`,
    },
    {
      stage: "constraint",
      detail: `Applied rule filtering, totalPenalty=${totalPenalty}, rejectedCount=${rejectedCount}`,
    },
    {
      stage: "scoring",
      detail: `Scored foods based on nutrition, digestibility, dosha; totalScore=${totalScore}`,
    },
    {
      stage: "diversity",
      detail: `Applied diversity penalties: totalDiversityPenalty=${totalDiversityPenalty}`,
    },
    {
      stage: "optimizer",
      detail: `Selected meal with score=${totalScore} across ${combinationCount} combinations${selectedMeal.length > 0 ? `: ${selectedMeal.join(", ")}` : ""}`,
    },
    {
      stage: "reliability",
      detail: getReliabilityMessage(safeContext),
    },
  ];
}

function generateStructuredExplanation(context, trace) {
  const safeContext = toSafeObject(context);
  const safeTrace = toSafeArray(trace);
  const mealResult = toSafeObject(safeContext.mealResult);
  const meta = toSafeObject(safeContext.meta);
  const items = getSelectedItems(safeContext);
  const meal = toSafeArray(mealResult.meal).filter((item) => typeof item === "string" && item.trim().length > 0);
  const highlights = Array.from(new Set([
    ...getConditionHighlights(items, safeContext),
    ...getScoringHighlights(items),
  ]));
  const warnings = [];
  const penaltyReasons = Array.from(new Set(getPenaltyReasons(items)));
  const totalPenalty = getTotalPenalty(safeContext);
  const totalDiversityPenalty = getTotalDiversityPenalty(safeContext);
  const totalScore = getTotalScore(safeContext);

  if (penaltyReasons.length > 0 || totalPenalty > 0) {
    warnings.push(
      penaltyReasons.length > 0
        ? `Penalty signals remained for: ${penaltyReasons.join("; ")}.`
        : `Penalty signals remained with totalPenalty=${totalPenalty}.`
    );
  }

  if (totalDiversityPenalty > 0) {
    warnings.push(`Diversity penalties were applied to reduce recent repetition (totalDiversityPenalty=${totalDiversityPenalty}).`);
  }

  if (meta.fallback) {
    warnings.push("Fallback meal was returned because valid meal generation was not possible.");
  } else if (toSafeNumber(meta.relaxationLevel, 0) > 0) {
    warnings.push(`Constraint relaxation level ${meta.relaxationLevel} was required to produce a meal.`);
  }

  const explanationParts = [];

  if (meta.fallback) {
    explanationParts.push(`Final meal: ${meal.length > 0 ? meal.join(", ") : "khichdi"}. System returned a fallback meal to preserve reliability under strict constraints.`);
  } else if (meal.length > 0) {
    explanationParts.push(`Final meal: ${meal.join(", ")} with total score ${totalScore}.`);
  } else {
    explanationParts.push("Meal selection completed without named items.");
  }

  if (highlights.length > 0) {
    explanationParts.push(`Selection rationale: ${highlights.join(" ")}`);
  }

  if (toSafeNumber(meta.relaxationLevel, 0) > 0 && !meta.fallback) {
    explanationParts.push(`Reliability logic relaxed constraints at level ${meta.relaxationLevel} to keep the plan valid.`);
  }

  if (warnings.length > 0) {
    explanationParts.push(`Warnings: ${warnings.join(" ")}`);
  }

  return {
    explanation: explanationParts.join(" "),
    highlights,
    warnings,
    trace: safeTrace,
  };
}

module.exports = {
  buildDecisionTrace,
  generateStructuredExplanation,
};
