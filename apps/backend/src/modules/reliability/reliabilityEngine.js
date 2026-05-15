const { toSafeArray, toSafeNumber, toSafeObject } = require("../../utils/safeUtils");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { filterFoods } = require("../../rules/engine/constraintEngine");
const { generateCandidates } = require("../candidate/candidateGenerator");
const { applyConstraints } = require("../constraint/constraintEngine");
const { scoreCandidates } = require("../scoring/scoringEngine");
const { applyDiversity } = require("../diversity/diversityEngine");
const { optimizeMeal } = require("../optimizer/optimizer");
const { getFallbackMeal } = require("./fallback.engine");

const RELAXATION_LEVELS = [
  { level: 0, excludedPriorities: [], label: "Strict" },
  { level: 1, excludedPriorities: ["P3"], label: "Light Relaxation" },
  { level: 2, excludedPriorities: ["P2", "P3"], label: "Heavy Relaxation" },
  { level: 3, excludedPriorities: ["P1", "P2", "P3"], label: "P0 Only" }
];

function clamp01(value) {
  return Math.max(0, Math.min(1, toSafeNumber(value, 0)));
}

function toMealPlanFromBreakdown(mealResult) {
  const safeBreakdown = toSafeObject(toSafeObject(mealResult).breakdown);
  const fixedItems = toSafeArray(toSafeObject(safeBreakdown.meta).fixedItems);
  const dynamicItems = toSafeArray(safeBreakdown.items);
  const items = [
    ...fixedItems.map((fixedItem) => ({ __fixed: true, value: fixedItem })),
    ...dynamicItems,
  ];

  const seen = new Set();

  return items
    .map((item) => {
      const isFixed = Boolean(toSafeObject(item).__fixed);
      const safe = isFixed ? toSafeObject(toSafeObject(item).value) : toSafeObject(item);
      const fixedValue = isFixed ? toSafeObject(item).value : null;

      const fixedName = typeof fixedValue === "string" && fixedValue.trim() ? fixedValue.trim() : "";
      const recipeId = typeof safe.recipe_id === "string" && safe.recipe_id.trim()
        ? safe.recipe_id.trim()
        : (typeof safe.id === "string" && safe.id.trim()
          ? safe.id.trim()
          : (fixedName || ""));
      const name = typeof safe.name === "string" && safe.name.trim()
        ? safe.name.trim()
        : (fixedName || recipeId);

      if (!recipeId || !name) {
        return null;
      }

      const dedupeKey = `${recipeId}`.toLowerCase();
      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      const safeQuantity = toSafeObject(safe.quantity);
      const safeNutrition = toSafeObject(safe.nutrition);

      return {
        recipe_id: recipeId,
        name,
        quantity: {
          value: Math.max(0, toSafeNumber(safeQuantity.value, 100)),
          unit: typeof safeQuantity.unit === "string" && safeQuantity.unit.trim() ? safeQuantity.unit.trim() : "grams",
        },
        nutrition: {
          calories: Math.max(0, toSafeNumber(safeNutrition.calories, 0)),
          protein: Math.max(0, toSafeNumber(safeNutrition.protein, 0)),
          carbs: Math.max(0, toSafeNumber(safeNutrition.carbs, 0)),
          fat: Math.max(0, toSafeNumber(safeNutrition.fat, 0)),
        },
      };
    })
    .filter(Boolean);
}
function computeNutritionSummary(mealResult) {
  const items = toSafeArray(toSafeObject(toSafeObject(mealResult).breakdown).items);

  return items.reduce((totals, item) => {
    const nutrition = toSafeObject(toSafeObject(item).nutrition);
    return {
      calories: Number((totals.calories + Math.max(0, toSafeNumber(nutrition.calories, 0))).toFixed(6)),
      protein: Number((totals.protein + Math.max(0, toSafeNumber(nutrition.protein, 0))).toFixed(6)),
      carbs: Number((totals.carbs + Math.max(0, toSafeNumber(nutrition.carbs, 0))).toFixed(6)),
      fat: Number((totals.fat + Math.max(0, toSafeNumber(nutrition.fat, 0))).toFixed(6)),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function buildConstraintRulesTrace(mealResult) {
  const items = toSafeArray(toSafeObject(toSafeObject(mealResult).breakdown).items);
  const rules = [];

  items.forEach((item) => {
    const evalObj = toSafeObject(toSafeObject(item).evaluation);
    const triggered = toSafeArray(evalObj.triggeredRules);

    triggered.forEach((rule) => {
      const safeRule = toSafeObject(rule);
      rules.push({
        rule_id: typeof safeRule.id === "string" && safeRule.id ? safeRule.id : "unknown_rule",
        action: typeof safeRule.action === "string" && safeRule.action.toLowerCase() === "reject" ? "reject" : "penalize",
        reason: typeof safeRule.reason === "string" && safeRule.reason ? safeRule.reason : "rule triggered",
      });
    });
  });

  return rules;
}

function normalizePriority(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function extractP0Rules(rules) {
  return toSafeArray(rules).filter((rule) => normalizePriority(toSafeObject(rule).priority) === "P0");
}

function assertP0Compliance(result, userState, rules) {
  const safeResult = toSafeObject(result);
  const p0Rules = extractP0Rules(rules);
  if (p0Rules.length === 0) {
    return;
  }

  const items = toSafeArray(toSafeObject(safeResult.breakdown).items);
  const validation = filterFoods(items, toSafeObject(userState), p0Rules);
  const rejected = toSafeArray(validation.rejectedFoods);

  if (rejected.length > 0) {
    const firstReject = toSafeObject(rejected[0]);
    const triggered = toSafeObject(firstReject.triggeredRule);
    throw new ContractViolationError("Reliability output violates P0 constraints", {
      source: "reliabilityEngine",
      reason: "P0_VIOLATION",
      rule_id: triggered.ruleId || "",
      message: triggered.reason || "P0 rule violation",
    });
  }
}

function computeDynamicConfidence(mealResult, optimizerStats, relaxationLevel) {
  const safeStats = toSafeObject(optimizerStats);
  const safeBreakdown = toSafeObject(toSafeObject(mealResult).breakdown);
  const safeMeta = toSafeObject(safeBreakdown.meta);

  const baseScore = clamp01(toSafeNumber(toSafeObject(mealResult).score, 0));
  const topScore = clamp01(toSafeNumber(safeStats.selectedScore, baseScore));
  const secondBestScore = clamp01(toSafeNumber(safeStats.secondBestScore, topScore));
  const poolSize = Math.max(0, toSafeNumber(safeStats.inputCount, 0));

  const relaxationImpacts = { 0: 1.0, 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.1 };
  const relaxation_impact = relaxationImpacts[relaxationLevel] || 0.1;

  let pool_quality = 1.0;
  if (poolSize <= 3) pool_quality = 0.5;
  else if (poolSize <= 10) pool_quality = 0.8;

  const scoreMargin = Math.max(0, topScore - secondBestScore);
  let score_confidence = 1.0;
  if (poolSize <= 1) {
    score_confidence = 0.5;
  } else if (scoreMargin <= 0.01) {
    score_confidence = 0.6;
  } else if (scoreMargin <= 0.05) {
    score_confidence = 0.8;
  }

  const totalPenalty = clamp01(toSafeNumber(safeMeta.totalPenalty, 0));
  const penalty_impact = Math.max(0, 1.0 - (totalPenalty * 2));

  const divPenalty = clamp01(toSafeNumber(safeMeta.totalDiversityPenalty, 0));
  const diversity_impact = Math.max(0, 1.0 - (divPenalty * 2));

  const rawConfidence = baseScore * relaxation_impact * pool_quality * score_confidence * penalty_impact * diversity_impact;

  return {
    value: clamp01(Number(rawConfidence.toFixed(6))),
    components: {
      relaxation_impact,
      pool_quality,
      score_confidence,
      penalty_impact,
      diversity_impact
    }
  };
}

function buildPassResult(mealResult, stageStats, confData) {
  const mealPlan = toMealPlanFromBreakdown(mealResult);

  if (mealPlan.length === 0) {
    throw new ContractViolationError("Reliability pass produced empty meal plan", {
      source: "reliabilityEngine",
    });
  }

  const result = {
    mealPlan,
    score: clamp01(toSafeNumber(toSafeObject(mealResult).score, 0)),
    breakdown: toSafeObject(mealResult).breakdown,
    nutrition_summary: computeNutritionSummary(mealResult),
    traceExtension: {
      constraint_rules: buildConstraintRulesTrace(mealResult),
      confidence_eval: confData ? confData.components : undefined,
    },
    confidence: {
      value: confData ? confData.value : clamp01(toSafeNumber(toSafeObject(mealResult).score, 0)),
      components: {
        penalty_impact: confData ? confData.components.penalty_impact : 1,
        diversity_impact: confData ? confData.components.diversity_impact : 1,
        relaxation_impact: confData ? confData.components.relaxation_impact : 1,
      },
    },
    meta: {
      fallback_used: false,
      relaxation_level: 0,
      fallback_reason: "",
    },
  };

  Object.defineProperty(result, "__stageStats", {
    value: {
      inputCount: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stageStats).inputCount, 0))),
      outputCount: 1,
      rejectedCount: 0,
      reason: "reliability_pass",
    },
    enumerable: false,
    writable: false,
  });

  return result;
}

function filterActiveRules(rules, level) {
  const safeRules = toSafeArray(rules);
  const def = RELAXATION_LEVELS.find((l) => l.level === level) || RELAXATION_LEVELS[0];
  const excluded = new Set(def.excludedPriorities);
  return safeRules.filter((rule) => {
    const priority = typeof rule === "object" && rule ? String(rule.priority).trim().toUpperCase() : "";
    return !excluded.has(priority);
  });
}

function relaxedPrioritiesForLevel(level) {
  const def = RELAXATION_LEVELS.find((l) => l.level === level) || RELAXATION_LEVELS[0];
  return [...def.excludedPriorities];
}

function runPipelinePass(input, activeRules) {
  const safeInput = toSafeObject(input);
  const candidates = generateCandidates(safeInput.template, safeInput.foods, safeInput.userState, activeRules);
  const constrained = applyConstraints(safeInput.template, candidates, safeInput.userState, activeRules);
  const scored = scoreCandidates(constrained, safeInput.userState, safeInput.template);
  const diversified = applyDiversity(scored, safeInput.userHistory);
  const mealResult = optimizeMeal(safeInput.template, diversified);
  return mealResult;
}

function buildLastResortFallbackMealResult(input) {
  const safeInput = toSafeObject(input);
  const p0Rules = extractP0Rules(safeInput.rules);
  const candidateFoods = toSafeArray(safeInput.foods)
    .map((food) => ({
      ...toSafeObject(food),
      evaluation: {
        isValid: true,
        totalPenalty: 0,
        triggeredRules: [],
      },
      quantity: {
        value: 100,
        unit: "grams",
      },
    }))
    .filter((food) => {
      const recipeId = typeof food.recipe_id === "string" && food.recipe_id.trim()
        ? food.recipe_id.trim()
        : (typeof food.id === "string" && food.id.trim() ? food.id.trim() : "");
      const name = typeof food.name === "string" && food.name.trim() ? food.name.trim() : "";
      return Boolean(recipeId || name);
    });

  const validation = filterFoods(candidateFoods, toSafeObject(safeInput.userState), p0Rules);
  const selected = toSafeObject(toSafeArray(validation.validFoods)[0] || candidateFoods[0]);

  const recipeId = typeof selected.recipe_id === "string" && selected.recipe_id.trim()
    ? selected.recipe_id.trim()
    : (typeof selected.id === "string" && selected.id.trim() ? selected.id.trim() : "emergency-safe-001");
  const name = typeof selected.name === "string" && selected.name.trim() ? selected.name.trim() : recipeId;

  return {
    score: 0,
    breakdown: {
      items: [
        {
          ...selected,
          recipe_id: recipeId,
          name,
          quantity: {
            value: Math.max(0, toSafeNumber(toSafeObject(selected.quantity).value, 100)),
            unit: typeof toSafeObject(selected.quantity).unit === "string" && toSafeObject(selected.quantity).unit.trim()
              ? toSafeObject(selected.quantity).unit.trim()
              : "grams",
          },
          nutrition: {
            calories: Math.max(0, toSafeNumber(toSafeObject(selected.nutrition).calories, 0)),
            protein: Math.max(0, toSafeNumber(toSafeObject(selected.nutrition).protein, 0)),
            carbs: Math.max(0, toSafeNumber(toSafeObject(selected.nutrition).carbs, 0)),
            fat: Math.max(0, toSafeNumber(toSafeObject(selected.nutrition).fat, 0)),
          },
          evaluation: {
            isValid: true,
            totalPenalty: 0,
            triggeredRules: [],
          },
        },
      ],
      meta: {
        totalPenalty: 0,
        totalDiversityPenalty: 0,
        fallback: true,
        fallback_safe: true,
      },
    },
    meta: {
      fallback_used: true,
      relaxation_level: 3,
      fallback_reason: "EMERGENCY_SAFE_P0",
    },
  };
}

function computeReliabilityResult(input) {
  const safeInput = toSafeObject(input);
  const mealResult = toSafeObject(safeInput.mealResult);
  const mealPlan = toMealPlanFromBreakdown(mealResult);

  const reliabilityInputCount = Math.max(
    0,
    Math.trunc(
      toSafeNumber(
        toSafeObject(safeInput.optimizerStats).outputCount,
        mealPlan.length > 0 ? 1 : 0
      )
    )
  );

  if (mealPlan.length > 0) {
    const confData = computeDynamicConfidence(mealResult, safeInput.optimizerStats, 0);
    const passResult = buildPassResult(mealResult, { inputCount: reliabilityInputCount }, confData);
    passResult.meta.relaxation_level = 0;
    passResult.meta.relaxed_priorities = [];
    assertP0Compliance(passResult, safeInput.userState, safeInput.rules);
    return passResult;
  }

  for (const level of [1, 2, 3]) {
    const activeRules = filterActiveRules(safeInput.rules, level);
    const passResultCandidate = runPipelinePass({
      template: safeInput.template,
      foods: safeInput.foods,
      userState: safeInput.userState,
      userHistory: safeInput.userHistory
    }, activeRules);
    
    const candidatePlan = toMealPlanFromBreakdown(passResultCandidate);

    if (candidatePlan.length > 0) {
      const confData = computeDynamicConfidence(passResultCandidate, passResultCandidate.__stageStats, level);
      const passResult = buildPassResult(passResultCandidate, { inputCount: reliabilityInputCount }, confData);
      passResult.meta.relaxation_level = level;
      passResult.meta.relaxed_priorities = relaxedPrioritiesForLevel(level);
      
      assertP0Compliance(passResult, safeInput.userState, safeInput.rules);
      return passResult;
    }
  }

  let fallbackCandidate;
  try {
    fallbackCandidate = getFallbackMeal({
      mealType: safeInput.mealType,
      foods: safeInput.foods,
      userState: safeInput.userState,
      rules: safeInput.rules,
      userHistory: safeInput.userHistory,
    });
  } catch (fallbackError) {
    fallbackCandidate = buildLastResortFallbackMealResult(safeInput);
  }

  const fallbackMealResult = {
    score: Math.max(0, toSafeNumber(toSafeObject(fallbackCandidate).score, 0)),
    breakdown: toSafeObject(toSafeObject(fallbackCandidate).breakdown),
  };
  const fallbackLevel = Math.max(0, Math.trunc(toSafeNumber(toSafeObject(toSafeObject(fallbackCandidate).meta).relaxation_level, 3)));
  const fallbackReason = typeof toSafeObject(toSafeObject(fallbackCandidate).meta).fallback_reason === "string"
    ? toSafeObject(toSafeObject(fallbackCandidate).meta).fallback_reason
    : "SAFE_FALLBACK";

  const fallbackConfidence = computeDynamicConfidence(
    fallbackMealResult,
    { inputCount: reliabilityInputCount, selectedScore: fallbackMealResult.score, secondBestScore: 0 },
    fallbackLevel
  );

  const fallbackResult = buildPassResult(fallbackMealResult, { inputCount: reliabilityInputCount }, fallbackConfidence);
  fallbackResult.meta.fallback_used = true;
  fallbackResult.meta.relaxation_level = fallbackLevel;
  fallbackResult.meta.relaxed_priorities = relaxedPrioritiesForLevel(fallbackLevel);
  fallbackResult.meta.fallback_reason = fallbackReason;

  assertP0Compliance(fallbackResult, safeInput.userState, safeInput.rules);
  return fallbackResult;
}

function isLegacyContextInput(input) {
  const safe = toSafeObject(input);
  return Boolean(safe.input && safe.meta && safe.template);
}

function toMealResultFromReliability(reliabilityResult) {
  const safe = toSafeObject(reliabilityResult);
  const names = toSafeArray(safe.mealPlan)
    .map((entry) => toSafeObject(entry).name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  return {
    meal: names,
    score: toSafeNumber(safe.score, 0),
    breakdown: {
      ...toSafeObject(safe.breakdown),
      items: toSafeArray(toSafeObject(safe.breakdown).items).map((item) => ({ ...toSafeObject(item) })),
    },
  };
}

function mergeLegacyContext(inputContext, reliabilityResult) {
  const safeContext = toSafeObject(inputContext);
  const safeMeta = toSafeObject(safeContext.meta);
  const safeReliabilityMeta = toSafeObject(toSafeObject(reliabilityResult).meta);

  return {
    ...safeContext,
    mealResult: toMealResultFromReliability(reliabilityResult),
    reliability: reliabilityResult,
    confidence: toSafeObject(reliabilityResult).confidence,
    meta: {
      ...safeMeta,
      fallback: Boolean(safeReliabilityMeta.fallback_used),
      relaxationLevel: Math.max(0, Math.trunc(toSafeNumber(safeReliabilityMeta.relaxation_level, 0))),
      fallbackReason: typeof safeReliabilityMeta.fallback_reason === "string" ? safeReliabilityMeta.fallback_reason : "",
      confidence: clamp01(toSafeNumber(toSafeObject(reliabilityResult).confidence.value, toSafeNumber(reliabilityResult.score, 0))),
    },
  };
}

function applyReliability(input) {
  const reliabilityResult = computeReliabilityResult(input);

  if (isLegacyContextInput(input)) {
    return mergeLegacyContext(input, reliabilityResult);
  }

  return reliabilityResult;
}

function computeConfidence(result) {
  const safe = toSafeObject(result);

  if (safe.reliability && typeof safe.reliability === "object") {
    const reliabilityConfidence = toSafeObject(safe.reliability).confidence;
    return clamp01(toSafeNumber(reliabilityConfidence.value, toSafeNumber(toSafeObject(safe.reliability).score, 0.3)));
  }

  return clamp01(toSafeNumber(toSafeObject(safe.confidence).value, toSafeNumber(safe.score, 0.3)));
}

function isLowQualityMeal(result) {
  const safe = toSafeObject(result);
  if (safe.reliability && typeof safe.reliability === "object") {
    return toSafeArray(toSafeObject(safe.reliability).mealPlan).length === 0 || toSafeNumber(toSafeObject(safe.reliability).score, 0) < 0.3;
  }

  return toSafeArray(safe.mealPlan).length === 0 || toSafeNumber(safe.score, 0) < 0.3;
}

module.exports = {
  applyReliability,
  computeConfidence,
  isLowQualityMeal,
  relaxConstraints: filterActiveRules,
};






