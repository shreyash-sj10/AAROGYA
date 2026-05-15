const { validateDecisionResponse } = require("../../contracts/validators/validateDecisionResponse");
const { buildDecisionResponse } = require("../../contracts/builders/decisionResponse.builder");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { toSafeObject, toSafeString, toSafeNumber, toSafeArray } = require("../../utils/safeUtils");

const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

function deterministicTimestamp(dayIndex) {
  return Math.max(1, Math.trunc(toSafeNumber(dayIndex, 1)) * 1000);
}

function buildMealInput({
  userState,
  constraints,
  mealType,
  dayIndex,
  foods,
  rules,
  userHistory,
}) {
  const safeUserState = toSafeObject(userState);
  const safeContext = toSafeObject(safeUserState.context);
  const safeUserHistory = toSafeObject(userHistory);

  return {
    request_id: `weekly_day_${dayIndex}_${mealType}`,
    trace_id: `weekly_day_${dayIndex}_${mealType}_trace`,
    mealType,
    userState: {
      ...safeUserState,
      context: {
        ...safeContext,
        meal_type: mealType,
      },
    },
    constraints: toSafeObject(constraints),
    context: {
      history: toSafeArray(safeUserHistory.persistentHistory),
    },
    foods: toSafeArray(foods),
    rules: toSafeArray(rules),
    userHistory: safeUserHistory,
    meta: {
      timestamp: deterministicTimestamp(dayIndex) + (mealType === "breakfast" ? 1 : mealType === "lunch" ? 2 : 3),
      request_source: "weekly_planner",
      cache_allowed: false,
    },
  };
}

function aggregateNutrition(responses) {
  return responses.reduce((totals, response) => {
    const nutrition = toSafeObject(toSafeObject(response).nutrition_summary);
    return {
      calories: Number((totals.calories + Math.max(0, toSafeNumber(nutrition.calories, 0))).toFixed(6)),
      protein: Number((totals.protein + Math.max(0, toSafeNumber(nutrition.protein, 0))).toFixed(6)),
      carbs: Number((totals.carbs + Math.max(0, toSafeNumber(nutrition.carbs, 0))).toFixed(6)),
      fat: Number((totals.fat + Math.max(0, toSafeNumber(nutrition.fat, 0))).toFixed(6)),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function aggregateScore(responses) {
  if (responses.length === 0) {
    return 0;
  }
  const total = responses.reduce((sum, response) => sum + Math.max(0, Math.min(1, toSafeNumber(toSafeObject(response).score, 0))), 0);
  return Number((total / responses.length).toFixed(6));
}

function aggregateConfidence(responses) {
  const value = responses.length === 0
    ? 0.3
    : Number((responses.reduce((sum, response) => sum + Math.max(0, Math.min(1, toSafeNumber(toSafeObject(toSafeObject(response).confidence).value, 0.3))), 0) / responses.length).toFixed(6));

  return {
    value,
    components: {
      penalty_impact: 1,
      diversity_impact: 1,
      relaxation_impact: 1,
    },
  };
}

function aggregateStageStats(responses) {
  const zero = {
    candidate_generator: { input_count: 0, output_count: 0 },
    constraint_engine: {
      input_count: 0,
      output_count: 0,
      rejected: 0,
      rules: [],
      p0_rules_checked: 0,
      p0_violations: 0,
      p0_violated_rule_ids: [],
    },
    scoring_engine: { input_count: 0, output_count: 0 },
    diversity_engine: { input_count: 0, output_count: 0 },
    optimizer: { input_count: 0, output_count: 0, combinations_evaluated: 0, selected_score: 0 },
    reliability_engine: { input_count: 0, output_count: 0 },
  };

  return responses.reduce((acc, response) => {
    const trace = toSafeObject(toSafeObject(response).trace);
    const stages = toSafeObject(trace.stages);

    acc.candidate_generator.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.candidate_generator).input_count, 0));
    acc.candidate_generator.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.candidate_generator).output_count, 0));

    acc.constraint_engine.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.constraint_engine).input_count, 0));
    acc.constraint_engine.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.constraint_engine).output_count, 0));
    acc.constraint_engine.rejected += Math.max(0, toSafeNumber(toSafeObject(stages.constraint_engine).rejected, 0));
    acc.constraint_engine.rules = acc.constraint_engine.rules.concat(toSafeArray(toSafeObject(stages.constraint_engine).rules));
    acc.constraint_engine.p0_rules_checked += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.constraint_engine).p0_rules_checked, 0)));
    acc.constraint_engine.p0_violations += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.constraint_engine).p0_violations, 0)));
    toSafeArray(toSafeObject(stages.constraint_engine).p0_violated_rule_ids).forEach((ruleId) => {
      const safeRuleId = toSafeString(ruleId, "");
      if (safeRuleId && !acc.constraint_engine.p0_violated_rule_ids.includes(safeRuleId)) {
        acc.constraint_engine.p0_violated_rule_ids.push(safeRuleId);
      }
    });

    acc.scoring_engine.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.scoring_engine).input_count, 0));
    acc.scoring_engine.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.scoring_engine).output_count, 0));

    acc.diversity_engine.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.diversity_engine).input_count, 0));
    acc.diversity_engine.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.diversity_engine).output_count, 0));

    acc.optimizer.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.optimizer).input_count, 0));
    acc.optimizer.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.optimizer).output_count, 0));
    acc.optimizer.combinations_evaluated += Math.max(0, toSafeNumber(toSafeObject(stages.optimizer).combinations_evaluated, 0));
    acc.optimizer.selected_score = Number((Math.max(0, toSafeNumber(acc.optimizer.selected_score, 0)) + Math.max(0, Math.min(1, toSafeNumber(toSafeObject(stages.optimizer).selected_score, 0)))) .toFixed(6));

    acc.reliability_engine.input_count += Math.max(0, toSafeNumber(toSafeObject(stages.reliability_engine).input_count, 0));
    acc.reliability_engine.output_count += Math.max(0, toSafeNumber(toSafeObject(stages.reliability_engine).output_count, 0));

    return acc;
  }, zero);
}

async function generateDayPlan(userState, dayState, options = {}) {
  const safeOptions = toSafeObject(options);
  const generatePlan = safeOptions.generatePlan;
  const dayIndex = Math.max(1, Math.trunc(toSafeNumber(safeOptions.dayIndex, 1)));

  if (typeof generatePlan !== "function") {
    throw new ContractViolationError("generateDayPlan requires options.generatePlan function", {
      source: "dailyPlanner.service",
    });
  }

  const responses = [];

  for (const mealType of MEAL_TYPES) {
    const mealInput = buildMealInput({
      userState,
      constraints: toSafeObject(safeOptions.constraints),
      mealType,
      dayIndex,
      foods: toSafeArray(safeOptions.foods),
      rules: toSafeArray(safeOptions.rules),
      userHistory: toSafeObject(safeOptions.userHistory),
    });

    const response = await Promise.resolve(generatePlan(mealInput));
    const validation = validateDecisionResponse(response);
    if (!validation.valid) {
      throw new ContractViolationError("Meal response invalid in daily planner", {
        source: "dailyPlanner.service",
        mealType,
        errors: validation.errors || [],
      });
    }

    responses.push(response);
  }

  const mergedMealPlan = responses.flatMap((response, idx) => {
    const mealType = MEAL_TYPES[idx];
    return toSafeArray(toSafeObject(response).meal_plan).map((entry) => {
      const safe = toSafeObject(entry);
      return {
        recipe_id: `${mealType}:${toSafeString(safe.recipe_id, "recipe")}`,
        name: `${mealType}:${toSafeString(safe.name, "meal")}`,
        quantity: {
          value: Math.max(0, toSafeNumber(toSafeObject(safe.quantity).value, 100)),
          unit: toSafeString(toSafeObject(safe.quantity).unit, "grams"),
        },
        nutrition: {
          calories: Math.max(0, toSafeNumber(toSafeObject(safe.nutrition).calories, 0)),
          protein: Math.max(0, toSafeNumber(toSafeObject(safe.nutrition).protein, 0)),
          carbs: Math.max(0, toSafeNumber(toSafeObject(safe.nutrition).carbs, 0)),
          fat: Math.max(0, toSafeNumber(toSafeObject(safe.nutrition).fat, 0)),
        },
      };
    });
  });

  const request = {
    request_id: `weekly_day_${dayIndex}_aggregate`,
    trace_id: `weekly_day_${dayIndex}_aggregate_trace`,
    meta: {
      timestamp: deterministicTimestamp(dayIndex),
    },
  };

  return buildDecisionResponse({
    request,
    internal: {
      mealPlan: mergedMealPlan,
      score: aggregateScore(responses),
      nutrition_summary: aggregateNutrition(responses),
      confidence: aggregateConfidence(responses),
      explanation: {
        deterministic: `Aggregated deterministic day plan for day ${dayIndex}.`,
        ai_explanation: "",
        citations: [],
      },
      meta: {
        latency_ms: 0,
        cache_hit: false,
        model_version: "assistive_offline_v1",
        prompt_version: "prompt_v1",
        rules_version: "rules_v1",
      },
    },
    stageStats: aggregateStageStats(responses),
  });
}

module.exports = {
  generateDayPlan,
};

