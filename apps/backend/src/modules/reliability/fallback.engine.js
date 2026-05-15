const { getBestTemplate, extractCategories } = require("../../templates/mealTemplate.service");
const { generateCandidates, computeScoreLite } = require("../candidate/candidateGenerator");
const { filterFoods } = require("../../rules/engine/constraintEngine");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { getFoods } = require("../../repositories/food.repository");
const { toSafeObject, toSafeArray } = require("../../utils/safeUtils");

function normalizePriority(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function cloneTriggeredRules(value) {
  return toSafeArray(value).map((rule) => ({ ...toSafeObject(rule) }));
}

function extractP0Rules(rules) {
  return toSafeArray(rules).filter((rule) => normalizePriority(toSafeObject(rule).priority) === "P0");
}

function flattenCandidateFoods(candidatesByCategory) {
  const safeMap = toSafeObject(candidatesByCategory);
  const categories = Object.keys(safeMap).sort();

  return categories.flatMap((category) => {
    return toSafeArray(safeMap[category]).map((food) => ({
      ...toSafeObject(food),
      category,
    }));
  });
}

function compareFallbackFood(leftFood, rightFood) {
  const leftPenalty = Number(toSafeObject(leftFood.evaluation).totalPenalty || 0);
  const rightPenalty = Number(toSafeObject(rightFood.evaluation).totalPenalty || 0);

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  const leftLite = computeScoreLite(leftFood);
  const rightLite = computeScoreLite(rightFood);
  if (leftLite !== rightLite) {
    return rightLite - leftLite;
  }

  const leftName = typeof leftFood.name === "string" ? leftFood.name : "";
  const rightName = typeof rightFood.name === "string" ? rightFood.name : "";
  return leftName.localeCompare(rightName);
}

function toMealPlanEntry(food) {
  const safe = toSafeObject(food);
  const recipeId = typeof safe.recipe_id === "string" && safe.recipe_id.trim()
    ? safe.recipe_id.trim()
    : (typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : "");
  const name = typeof safe.name === "string" && safe.name.trim() ? safe.name.trim() : recipeId;

  if (!recipeId || !name) {
    throw new ContractViolationError("Fallback candidate cannot be converted to contract meal entry", {
      source: "fallback.engine",
    });
  }

  return {
    recipe_id: recipeId,
    name,
    quantity: {
      value: 100,
      unit: "grams",
    },
  };
}

function toInternalFallbackResult(selected, level, reason) {
  const safeSelected = toSafeObject(selected);
  const mealPlan = [toMealPlanEntry(safeSelected)];
  const totalPenalty = Number(toSafeObject(safeSelected.evaluation).totalPenalty || 0);

  return {
    mealPlan,
    score: 0,
    breakdown: {
      items: [
        {
          ...safeSelected,
          evaluation: {
            isValid: true,
            totalPenalty,
            triggeredRules: cloneTriggeredRules(toSafeObject(safeSelected.evaluation).triggeredRules),
          },
        },
      ],
      totalScore: 0,
      meta: {
        fixedItems: [],
        flexibleCategories: [typeof safeSelected.category === "string" ? safeSelected.category : ""].filter(Boolean),
        categoriesUsed: [typeof safeSelected.category === "string" ? safeSelected.category : ""].filter(Boolean),
        totalPenalty,
        totalDiversityPenalty: 0,
        combinationCount: 1,
        fallback: true,
        fallback_safe: true,
      },
    },
    traceExtension: {
      constraint_rules: cloneTriggeredRules(toSafeObject(safeSelected.evaluation).triggeredRules).map((rule) => ({
        rule_id: typeof rule.id === "string" && rule.id ? rule.id : "fallback_rule",
        action: typeof rule.action === "string" && rule.action.toLowerCase() === "reject" ? "reject" : "penalize",
        reason: typeof rule.reason === "string" && rule.reason ? rule.reason : "fallback rule",
      })),
    },
    meta: {
      fallback_used: true,
      relaxation_level: level,
      fallback_reason: reason,
    },
  };
}

function pickPoolFoods(contextFoods) {
  const primary = toSafeArray(contextFoods).filter((food) => food && typeof food === "object");
  if (primary.length > 0) {
    return primary;
  }
  return toSafeArray(getFoods()).filter((food) => food && typeof food === "object");
}

function ensureEmergencyCandidate(template, foods) {
  const safeFoods = toSafeArray(foods);
  if (safeFoods.length > 0) {
    return safeFoods;
  }

  const preferredCategory = toSafeArray(extractCategories(template))[0] || "vegetable";
  return [{
    id: "emergency-safe-001",
    recipe_id: "emergency-safe-001",
    name: "Steamed Bottle Gourd",
    category: preferredCategory,
    ayurveda: {
      rasa: ["sweet"],
      guna: ["light"],
      virya: "cold",
      vipaka: "sweet",
    },
    dosha_effect: {
      vata: -0.2,
      pitta: -0.4,
      kapha: -0.2,
    },
    functional: {
      digestibility_score: 0.9,
      heaviness_score: 0.2,
    },
    nutrition: {
      calories: 18,
      protein: 0.8,
      carbs: 3.5,
      fat: 0.2,
      glycemic_index: 15,
    },
    meta: {
      is_vegetarian: true,
    },
    evaluation: {
      isValid: true,
      totalPenalty: 0,
      triggeredRules: [],
    },
  }];
}

function generateSafeFallback(context) {
  const safeContext = toSafeObject(context);
  const mealType = (typeof safeContext.mealType === "string" && safeContext.mealType.trim()) ? safeContext.mealType.trim() : "lunch";
  const template = getBestTemplate(mealType);

  if (!template) {
    throw new ContractViolationError("No template available for safe fallback", {
      source: "fallback.engine",
      mealType,
    });
  }

  const p0Rules = extractP0Rules(safeContext.rules);
  const poolFoods = ensureEmergencyCandidate(template, pickPoolFoods(safeContext.foods));
  const candidatesByCategory = generateCandidates(
    template,
    poolFoods,
    toSafeObject(safeContext.userState),
    p0Rules,
    { topK: 3 }
  );

  const minimalSet = flattenCandidateFoods(candidatesByCategory);
  const searchSet = minimalSet.length > 0
    ? minimalSet
    : poolFoods.map((food) => ({ ...toSafeObject(food) }));

  const filtered = filterFoods(searchSet, toSafeObject(safeContext.userState), p0Rules);
  const validFoods = toSafeArray(filtered.validFoods).sort(compareFallbackFood);

  if (validFoods.length === 0) {
    throw new ContractViolationError("Safe fallback could not find any P0-valid meal", {
      source: "fallback.engine",
      reason: "NO_SAFE_MEAL_FOUND",
    });
  }

  return toInternalFallbackResult(validFoods[0], 3, "SAFE_P0_ONLY");
}

function relaxRulesKeepingP0(rules, level) {
  const safeRules = toSafeArray(rules);

  if (level <= 0) {
    return safeRules;
  }

  if (level === 1) {
    return safeRules.filter((rule) => toSafeObject(rule).priority !== "P3");
  }

  return safeRules.filter((rule) => {
    const priority = toSafeObject(rule).priority;
    return priority !== "P2" && priority !== "P3";
  });
}

function runPipelineAttempt(baseContext, activeRules, level, reason) {
  const safeContext = toSafeObject(baseContext);
  const mealType = (typeof safeContext.mealType === "string" && safeContext.mealType.trim()) ? safeContext.mealType.trim() : "lunch";
  const template = getBestTemplate(mealType);

  if (!template) {
    throw new ContractViolationError("No template available for fallback attempt", {
      source: "fallback.engine",
      mealType,
      level,
    });
  }

  const candidates = generateCandidates(
    template,
    pickPoolFoods(safeContext.foods),
    toSafeObject(safeContext.userState),
    toSafeArray(activeRules)
  );

  const candidatesFlat = flattenCandidateFoods(candidates);
  if (candidatesFlat.length === 0) {
    throw new ContractViolationError("Fallback attempt generated zero candidates", {
      source: "fallback.engine",
      level,
      reason,
    });
  }

  const selected = candidatesFlat.sort(compareFallbackFood)[0];
  return toInternalFallbackResult(selected, level, reason);
}

function getFallbackMeal(context) {
  const safeContext = toSafeObject(context);
  const rules = toSafeArray(safeContext.rules);

  try {
    const level1Rules = relaxRulesKeepingP0(rules, 1);
    return runPipelineAttempt(safeContext, level1Rules, 1, "P3_RELAXED");
  } catch (level1Error) {
    try {
      const level2Rules = relaxRulesKeepingP0(rules, 2);
      return runPipelineAttempt(safeContext, level2Rules, 2, "P2_P3_RELAXED");
    } catch (level2Error) {
      return generateSafeFallback(safeContext);
    }
  }
}

module.exports = {
  getFallbackMeal,
  generateSafeFallback,
};

