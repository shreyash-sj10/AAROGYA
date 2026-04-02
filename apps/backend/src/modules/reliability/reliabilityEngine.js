const { toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { filterFoods } = require("../../rules/engine/constraintEngine");
const { generateSafeFallback } = require("./fallback.engine");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toSafeNumber(value, 0)));
}

function toMealPlanFromBreakdown(mealResult) {
  const items = toSafeArray(toSafeObject(toSafeObject(mealResult).breakdown).items);
  return items
    .map((item) => {
      const safe = toSafeObject(item);
      const recipeId = typeof safe.recipe_id === "string" && safe.recipe_id.trim()
        ? safe.recipe_id.trim()
        : (typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : "");
      const name = typeof safe.name === "string" && safe.name.trim() ? safe.name.trim() : recipeId;
      if (!recipeId || !name) {
        return null;
      }
      return {
        recipe_id: recipeId,
        name,
        quantity: {
          value: 100,
          unit: "grams",
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

function buildPassResult(mealResult, stageStats) {
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
    },
    confidence: {
      value: clamp01(toSafeNumber(toSafeObject(mealResult).score, 0)),
      components: {
        penalty_impact: 1,
        diversity_impact: 1,
        relaxation_impact: 1,
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

function buildSafeFallbackResult(safeFallback, inputCount) {
  const fallbackItems = toSafeArray(toSafeObject(toSafeObject(safeFallback).breakdown).items);

  const result = {
    mealPlan: toSafeArray(toSafeObject(safeFallback).mealPlan),
    score: clamp01(toSafeNumber(toSafeObject(safeFallback).score, 0)),
    breakdown: {
      ...toSafeObject(toSafeObject(safeFallback).breakdown),
      items: fallbackItems.map((item) => ({ ...toSafeObject(item) })),
    },
    nutrition_summary: computeNutritionSummary({ breakdown: { items: fallbackItems } }),
    traceExtension: {
      constraint_rules: toSafeArray(toSafeObject(toSafeObject(safeFallback).traceExtension).constraint_rules),
    },
    confidence: {
      value: clamp01(toSafeNumber(toSafeObject(safeFallback).score, 0)),
      components: {
        penalty_impact: 1,
        diversity_impact: 1,
        relaxation_impact: 0,
      },
    },
    meta: {
      fallback_used: true,
      relaxation_level: Math.max(1, Math.trunc(toSafeNumber(toSafeObject(toSafeObject(safeFallback).meta).relaxation_level, 3))),
      fallback_reason: typeof toSafeObject(toSafeObject(safeFallback).meta).fallback_reason === "string"
        ? toSafeObject(toSafeObject(safeFallback).meta).fallback_reason
        : "SAFE_P0_ONLY",
    },
  };

  Object.defineProperty(result, "__stageStats", {
    value: {
      inputCount: Math.max(0, Math.trunc(toSafeNumber(inputCount, 0))),
      outputCount: 1,
      rejectedCount: 0,
      reason: "reliability_safe_fallback",
    },
    enumerable: false,
    writable: false,
  });

  return result;
}

function applyReliability(input) {
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
    const passResult = buildPassResult(mealResult, { inputCount: reliabilityInputCount });
    assertP0Compliance(passResult, safeInput.userState, safeInput.rules);
    return passResult;
  }

  const safeFallback = generateSafeFallback({
    mealType: safeInput.mealType,
    foods: toSafeArray(safeInput.foods),
    userState: toSafeObject(safeInput.userState),
    rules: toSafeArray(safeInput.rules),
  });

  const fallbackResult = buildSafeFallbackResult(safeFallback, reliabilityInputCount);
  assertP0Compliance(fallbackResult, safeInput.userState, safeInput.rules);
  return fallbackResult;
}

function computeConfidence(result) {
  const safe = toSafeObject(result);
  return clamp01(toSafeNumber(toSafeObject(safe.confidence).value, toSafeNumber(safe.score, 0.3)));
}

function isLowQualityMeal(result) {
  return toSafeArray(toSafeObject(result).mealPlan).length === 0 || toSafeNumber(result && result.score, 0) < 0.3;
}

function relaxConstraints(rules, level) {
  const safeRules = toSafeArray(rules);
  if (level <= 0) {
    return safeRules.slice();
  }
  if (level === 1) {
    return safeRules.filter((rule) => toSafeObject(rule).priority !== "P3");
  }
  return safeRules.filter((rule) => {
    const priority = toSafeObject(rule).priority;
    return priority !== "P2" && priority !== "P3";
  });
}

module.exports = {
  applyReliability,
  computeConfidence,
  isLowQualityMeal,
  relaxConstraints,
};

