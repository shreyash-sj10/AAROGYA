const { generateDayPlan } = require("./dailyPlanner.service");
const { buildDecisionResponse } = require("../../contracts/builders/decisionResponse.builder");
const { generateMealPlan } = require("../../core/pipeline/orchestrator");
const { loadAllFoods } = require("../food");
const defaultRules = require("../../rules/engine/rule.samples");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");

const DETERMINISTIC_DEFAULT_START_DATE = "2026-01-01";

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toSafeNumber(value, 0)));
}

function parseDate(input) {
  const safeValue = toSafeString(input, "");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(safeValue)) {
    return null;
  }

  const parsed = new Date(`${safeValue}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveStartDate(startDate, fallbackStartDate) {
  return (
    parseDate(startDate)
    || parseDate(fallbackStartDate)
    || parseDate(DETERMINISTIC_DEFAULT_START_DATE)
  );
}

function normalizeRequestedDays(value) {
  const parsed = Math.trunc(toSafeNumber(value, 7));
  return Math.max(1, Math.min(7, parsed));
}

function normalizeInputArguments(input, legacyStartDate, legacyOptions) {
  const firstArg = toSafeObject(input);

  if (firstArg && firstArg.userState && typeof firstArg.userState === "object") {
    return {
      mode: "contract",
      request_id: toSafeString(firstArg.request_id, "weekly_request"),
      trace_id: toSafeString(firstArg.trace_id, "weekly_trace"),
      userState: toSafeObject(firstArg.userState),
      week_context: toSafeObject(firstArg.week_context),
      meta: toSafeObject(firstArg.meta),
      userHistory: toSafeObject(firstArg.userHistory),
      weeklyState: toSafeObject(firstArg.weeklyState),
    };
  }

  const safeLegacyOptions = toSafeObject(legacyOptions);
  return {
    mode: "legacy",
    request_id: `weekly_${normalizeRequestedDays(safeLegacyOptions.days)}_days`,
    trace_id: `weekly_${normalizeRequestedDays(safeLegacyOptions.days)}_days_trace`,
    userState: firstArg,
    week_context: {
      days: normalizeRequestedDays(safeLegacyOptions.days),
      start_date: toSafeString(legacyStartDate, DETERMINISTIC_DEFAULT_START_DATE),
    },
    meta: {
      timestamp: Math.max(0, Math.trunc(Date.now() / 1000)),
    },
    userHistory: toSafeObject(safeLegacyOptions.userHistory),
    weeklyState: toSafeObject(safeLegacyOptions.weeklyState),
  };
}

function buildWeeklyPlanEntries(dayResponses) {
  return dayResponses.map((response, index) => {
    const safe = toSafeObject(response);
    const safeConfidence = toSafeObject(safe.confidence);
    return {
      day: index + 1,
      meal_plan: toSafeArray(safe.meal_plan),
      nutrition_summary: toSafeObject(safe.nutrition_summary),
      score: clamp01(safe.score),
      confidence: clamp01(safeConfidence.value),
    };
  });
}

function aggregateNutrition(dayResponses) {
  return dayResponses.reduce((totals, response) => {
    const nutrition = toSafeObject(toSafeObject(response).nutrition_summary);
    return {
      calories: Number((totals.calories + Math.max(0, toSafeNumber(nutrition.calories, 0))).toFixed(6)),
      protein: Number((totals.protein + Math.max(0, toSafeNumber(nutrition.protein, 0))).toFixed(6)),
      carbs: Number((totals.carbs + Math.max(0, toSafeNumber(nutrition.carbs, 0))).toFixed(6)),
      fat: Number((totals.fat + Math.max(0, toSafeNumber(nutrition.fat, 0))).toFixed(6)),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function aggregateScore(dayResponses) {
  if (dayResponses.length === 0) {
    return 0;
  }
  const total = dayResponses.reduce((sum, response) => sum + clamp01(toSafeObject(response).score), 0);
  return Number((total / dayResponses.length).toFixed(6));
}

function aggregateStageStats(dayResponses, includeRules = false) {
  const zero = {
    candidate_generator: { input_count: 0, output_count: 0 },
    constraint_engine: includeRules
      ? { input_count: 0, output_count: 0, rejected: 0, rules: [] }
      : { input_count: 0, output_count: 0, rejected: 0 },
    scoring_engine: { input_count: 0, output_count: 0 },
    diversity_engine: { input_count: 0, output_count: 0 },
    optimizer: includeRules
      ? { input_count: 0, output_count: 0, combinations_evaluated: 0, selected_score: 0 }
      : { input_count: 0, output_count: 0, combinations_evaluated: 0 },
    reliability_engine: { input_count: 0, output_count: 0 },
  };

  return dayResponses.reduce((acc, response) => {
    const stages = toSafeObject(toSafeObject(toSafeObject(response).trace).stages);

    acc.candidate_generator.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.candidate_generator).input_count, 0)));
    acc.candidate_generator.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.candidate_generator).output_count, 0)));

    acc.constraint_engine.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.constraint_engine).input_count, 0)));
    acc.constraint_engine.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.constraint_engine).output_count, 0)));
    acc.constraint_engine.rejected += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.constraint_engine).rejected, 0)));
    if (includeRules) {
      acc.constraint_engine.rules = acc.constraint_engine.rules.concat(toSafeArray(toSafeObject(stages.constraint_engine).rules));
    }

    acc.scoring_engine.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.scoring_engine).input_count, 0)));
    acc.scoring_engine.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.scoring_engine).output_count, 0)));

    acc.diversity_engine.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.diversity_engine).input_count, 0)));
    acc.diversity_engine.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.diversity_engine).output_count, 0)));

    acc.optimizer.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.optimizer).input_count, 0)));
    acc.optimizer.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.optimizer).output_count, 0)));
    acc.optimizer.combinations_evaluated += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.optimizer).combinations_evaluated, 0)));
    if (includeRules) {
      acc.optimizer.selected_score = Number((Math.max(0, toSafeNumber(acc.optimizer.selected_score, 0)) + clamp01(toSafeObject(stages.optimizer).selected_score)).toFixed(6));
    }

    acc.reliability_engine.input_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.reliability_engine).input_count, 0)));
    acc.reliability_engine.output_count += Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stages.reliability_engine).output_count, 0)));

    return acc;
  }, zero);
}

function buildTraceV1(traceId, timestamp, dayResponses) {
  const stats = aggregateStageStats(dayResponses, true);
  const safeOptimizerOutput = Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.optimizer).output_count, 0)));

  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: toSafeString(traceId, "weekly_trace"),
    timestamp: Math.max(0, Math.trunc(toSafeNumber(timestamp, 0))),
    stages: {
      candidate_generator: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.candidate_generator).input_count, 0))),
        output_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.candidate_generator).output_count, 0))),
      },
      constraint_engine: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.constraint_engine).input_count, 0))),
        output_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.constraint_engine).output_count, 0))),
        rejected: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.constraint_engine).rejected, 0))),
        rules: toSafeArray(toSafeObject(stats.constraint_engine).rules).map((rule) => {
          const safeRule = toSafeObject(rule);
          return {
            rule_id: toSafeString(safeRule.rule_id || safeRule.ruleId, "weekly_rule"),
            action: toSafeString(safeRule.action, "penalize") === "reject" ? "reject" : "penalize",
            reason: toSafeString(safeRule.reason, "weekly_rule_triggered"),
          };
        }),
      },
      scoring_engine: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.scoring_engine).input_count, 0))),
        output_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.scoring_engine).output_count, 0))),
      },
      diversity_engine: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.diversity_engine).input_count, 0))),
        output_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.diversity_engine).output_count, 0))),
      },
      optimizer: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.optimizer).input_count, 0))),
        output_count: safeOptimizerOutput,
        combinations_evaluated: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.optimizer).combinations_evaluated, 0))),
        selected_score: safeOptimizerOutput > 0
          ? clamp01(toSafeNumber(toSafeObject(stats.optimizer).selected_score, 0) / safeOptimizerOutput)
          : 0,
      },
      reliability_engine: {
        input_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.reliability_engine).input_count, 0))),
        output_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stats.reliability_engine).output_count, 0))),
      },
    },
  };
}

function buildLegacyResponse(normalized, requestedDays, parsedStartDate, dayResponses) {
  const mergedMealPlan = dayResponses.flatMap((response, index) => {
    const day = index + 1;
    return toSafeArray(toSafeObject(response).meal_plan).map((entry) => {
      const safe = toSafeObject(entry);
      return {
        recipe_id: `d${day}:${toSafeString(safe.recipe_id, "recipe")}`,
        name: `d${day}:${toSafeString(safe.name, "meal")}`,
        quantity: {
          value: Math.max(0, toSafeNumber(toSafeObject(safe.quantity).value, 100)),
          unit: toSafeString(toSafeObject(safe.quantity).unit, "grams"),
        },
      };
    });
  });

  return buildDecisionResponse({
    request: {
      request_id: toSafeString(normalized.request_id, `weekly_${requestedDays}_days`),
      trace_id: toSafeString(normalized.trace_id, `weekly_${requestedDays}_days_trace`),
      meta: {
        timestamp: Math.max(0, Math.trunc(parsedStartDate.getTime() / 1000)),
      },
    },
    internal: {
      mealPlan: mergedMealPlan,
      score: aggregateScore(dayResponses),
      nutrition_summary: aggregateNutrition(dayResponses),
      confidence: {
        value: aggregateScore(dayResponses),
        components: {
          penalty_impact: 1,
          diversity_impact: 1,
          relaxation_impact: 1,
        },
      },
      explanation: {
        deterministic: `Aggregated deterministic weekly plan for ${requestedDays} days.`,
        ai_explanation: "",
        citations: [],
      },
      meta: {
        latency_ms: 0,
        cache_hit: false,
      },
    },
    stageStats: aggregateStageStats(dayResponses, true),
  });
}

async function generateWeeklyPlan(input, legacyStartDate, legacyOptions) {
  const normalized = normalizeInputArguments(input, legacyStartDate, legacyOptions);
  const safeWeekContext = toSafeObject(normalized.week_context);
  const safeMeta = toSafeObject(normalized.meta);

  const requestedDays = normalizeRequestedDays(safeWeekContext.days);
  const parsedStartDate = resolveStartDate(safeWeekContext.start_date, DETERMINISTIC_DEFAULT_START_DATE);

  if (!parsedStartDate) {
    throw new ContractViolationError("Unable to resolve deterministic start date for weekly plan", {
      source: "weeklyPlanner.service",
    });
  }

  const foods = loadAllFoods();
  const rules = toSafeArray(defaultRules);

  const dayResponses = [];
  for (let dayIndex = 1; dayIndex <= requestedDays; dayIndex += 1) {
    const dayResponse = await generateDayPlan(toSafeObject(normalized.userState), {}, {
      dayIndex,
      foods,
      rules,
      userHistory: toSafeObject(normalized.userHistory),
      weeklyState: toSafeObject(normalized.weeklyState),
      generatePlan: generateMealPlan,
    });
    dayResponses.push(dayResponse);
  }

  if (normalized.mode === "legacy") {
    return buildLegacyResponse(normalized, requestedDays, parsedStartDate, dayResponses);
  }

  return {
    version: "WeeklyDecisionResponse_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: toSafeString(normalized.request_id, `weekly_${Math.max(0, Math.trunc(toSafeNumber(safeMeta.timestamp, 0)))}`),
    trace_id: toSafeString(normalized.trace_id, "weekly_trace"),
    weekly_plan: buildWeeklyPlanEntries(dayResponses),
    trace: buildTraceV1(
      toSafeString(normalized.trace_id, "weekly_trace"),
      Math.max(0, Math.trunc(parsedStartDate.getTime() / 1000)),
      dayResponses
    ),
    meta: {
      latency_ms: 0,
      cache_hit: false,
      model_version: "assistive_offline_v1",
      prompt_version: "prompt_v1",
      rules_version: "rules_v1",
    },
  };
}

module.exports = {
  generateWeeklyPlan,
};


