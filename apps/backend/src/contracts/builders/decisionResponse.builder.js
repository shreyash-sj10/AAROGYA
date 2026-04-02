const { validateDecisionResponse } = require("../validators/validateDecisionResponse");
const { validateTrace } = require("../validators/validateTrace");
const { ContractViolationError } = require("../errors/ContractViolationError");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeQuantity(quantity) {
  const safe = toSafeObject(quantity);
  return {
    value: Math.max(0, toSafeNumber(safe.value, 100)),
    unit: toSafeString(safe.unit, "grams"),
  };
}

function normalizeMealPlan(mealPlan) {
  const normalized = toSafeArray(mealPlan)
    .map((entry) => {
      const safeEntry = toSafeObject(entry);
      return {
        recipe_id: toSafeString(safeEntry.recipe_id || safeEntry.id || safeEntry.name, ""),
        name: toSafeString(safeEntry.name || safeEntry.recipe_id || safeEntry.id, ""),
        quantity: normalizeQuantity(safeEntry.quantity),
      };
    })
    .filter((entry) => entry.recipe_id && entry.name);

  if (normalized.length === 0) {
    throw new ContractViolationError("Decision response requires at least one meal_plan item", {
      contract: "DecisionResponse_v1",
    });
  }

  return normalized;
}

function normalizeNutritionSummary(value) {
  const safe = toSafeObject(value);
  return {
    calories: Math.max(0, toSafeNumber(safe.calories, 0)),
    protein: Math.max(0, toSafeNumber(safe.protein, 0)),
    carbs: Math.max(0, toSafeNumber(safe.carbs, 0)),
    fat: Math.max(0, toSafeNumber(safe.fat, 0)),
  };
}

function normalizeExplanation(value) {
  const safe = toSafeObject(value);
  const citations = toSafeArray(safe.citations)
    .map((citation) => {
      const safeCitation = toSafeObject(citation);
      return {
        text_id: toSafeString(safeCitation.text_id, ""),
        source: toSafeString(safeCitation.source, ""),
        chapter: toSafeString(safeCitation.chapter, ""),
      };
    })
    .filter((citation) => citation.text_id && citation.source && citation.chapter);

  return {
    deterministic: toSafeString(safe.deterministic, ""),
    ai_explanation: toSafeString(safe.ai_explanation, ""),
    citations,
  };
}

function normalizeStage(stage, defaults = {}) {
  const safe = toSafeObject(stage);
  return {
    ...defaults,
    ...Object.keys(defaults).reduce((acc, key) => {
      if (key === "rules") {
        const rules = toSafeArray(safe.rules).map((rule) => {
          const safeRule = toSafeObject(rule);
          const action = toSafeString(safeRule.action, "penalize");
          return {
            rule_id: toSafeString(safeRule.rule_id, "unknown_rule"),
            action: action === "reject" ? "reject" : "penalize",
            reason: toSafeString(safeRule.reason, "rule triggered"),
          };
        });
        acc[key] = rules;
        return acc;
      }

      if (key === "selected_score") {
        acc[key] = clamp01(toSafeNumber(safe[key], defaults[key]));
        return acc;
      }

      acc[key] = Math.max(0, Math.trunc(toSafeNumber(safe[key], defaults[key])));
      return acc;
    }, {}),
  };
}

function assertTraceIntegrity(trace) {
  const stages = toSafeObject(toSafeObject(trace).stages);
  const candidate = toSafeObject(stages.candidate_generator);
  const constraint = toSafeObject(stages.constraint_engine);
  const scoring = toSafeObject(stages.scoring_engine);
  const diversity = toSafeObject(stages.diversity_engine);
  const optimizer = toSafeObject(stages.optimizer);
  const reliability = toSafeObject(stages.reliability_engine);

  const pairs = [
    { prev: candidate.output_count, next: constraint.input_count, link: "candidate_generator->constraint_engine" },
    { prev: constraint.output_count, next: scoring.input_count, link: "constraint_engine->scoring_engine" },
    { prev: scoring.output_count, next: diversity.input_count, link: "scoring_engine->diversity_engine" },
    { prev: diversity.output_count, next: optimizer.input_count, link: "diversity_engine->optimizer" },
    { prev: optimizer.output_count, next: reliability.input_count, link: "optimizer->reliability_engine" },
  ];

  pairs.forEach((pair) => {
    if (Math.trunc(toSafeNumber(pair.prev, -1)) !== Math.trunc(toSafeNumber(pair.next, -2))) {
      throw new ContractViolationError("Trace stage count transition mismatch", {
        contract: "Trace_v1",
        link: pair.link,
        prev_output_count: pair.prev,
        next_input_count: pair.next,
      });
    }
  });
}

function buildTrace(input) {
  const safe = toSafeObject(input);
  const stageStats = toSafeObject(safe.stageStats);

  const trace = {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: toSafeString(safe.traceId, "trace_missing"),
    timestamp: Math.max(0, Math.trunc(toSafeNumber(safe.timestamp, 0))),
    stages: {
      candidate_generator: normalizeStage(stageStats.candidate_generator, {
        input_count: 0,
        output_count: 0,
      }),
      constraint_engine: normalizeStage(stageStats.constraint_engine, {
        input_count: 0,
        output_count: 0,
        rejected: 0,
        rules: [],
      }),
      scoring_engine: normalizeStage(stageStats.scoring_engine, {
        input_count: 0,
        output_count: 0,
      }),
      diversity_engine: normalizeStage(stageStats.diversity_engine, {
        input_count: 0,
        output_count: 0,
      }),
      optimizer: normalizeStage(stageStats.optimizer, {
        input_count: 0,
        output_count: 0,
        combinations_evaluated: 0,
        selected_score: 0,
      }),
      reliability_engine: normalizeStage(stageStats.reliability_engine, {
        input_count: 0,
        output_count: 0,
      }),
    },
  };

  assertTraceIntegrity(trace);

  const traceValidation = validateTrace(trace);
  if (!traceValidation.valid) {
    throw new ContractViolationError("Trace_v1 validation failed", {
      contract: "Trace_v1",
      errors: traceValidation.errors || [],
    });
  }

  return trace;
}

function buildDecisionResponse(input) {
  const safe = toSafeObject(input);
  const request = toSafeObject(safe.request);
  const internal = toSafeObject(safe.internal);
  const score = clamp01(toSafeNumber(internal.score, 0));
  const confidenceValue = clamp01(toSafeNumber(toSafeObject(internal.confidence).value, score));
  const confidenceLevel = confidenceValue < 0.5 ? "low" : (confidenceValue < 0.8 ? "medium" : "high");

  const trace = buildTrace({
    traceId: toSafeString(request.trace_id, ""),
    timestamp: toSafeNumber(toSafeObject(request.meta).timestamp, 0),
    stageStats: safe.stageStats,
  });

  const response = {
    version: "DecisionResponse_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: toSafeString(request.request_id, "request_missing"),
    trace_id: toSafeString(request.trace_id, "trace_missing"),
    meal_plan: normalizeMealPlan(internal.mealPlan),
    nutrition_summary: normalizeNutritionSummary(internal.nutrition_summary),
    score,
    confidence: {
      version: "Confidence_v1",
      schema_version: 1,
      compatibility: "backward",
      value: confidenceValue,
      level: confidenceLevel,
      components: {
        penalty_impact: clamp01(toSafeNumber(toSafeObject(toSafeObject(internal.confidence).components).penalty_impact, 1)),
        diversity_impact: clamp01(toSafeNumber(toSafeObject(toSafeObject(internal.confidence).components).diversity_impact, 1)),
        relaxation_impact: clamp01(toSafeNumber(toSafeObject(toSafeObject(internal.confidence).components).relaxation_impact, 1)),
      },
    },
    trace,
    explanation: normalizeExplanation(internal.explanation),
    meta: {
      latency_ms: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(internal.meta).latency_ms, 0))),
      cache_hit: Boolean(toSafeObject(internal.meta).cache_hit),
      model_version: toSafeString(toSafeObject(internal.meta).model_version, "assistive_offline_v1"),
      prompt_version: toSafeString(toSafeObject(internal.meta).prompt_version, "prompt_v1"),
      rules_version: toSafeString(toSafeObject(internal.meta).rules_version, "rules_v1"),
    },
  };

  const validation = validateDecisionResponse(response);
  if (!validation.valid) {
    throw new ContractViolationError("DecisionResponse_v1 validation failed", {
      contract: "DecisionResponse_v1",
      errors: validation.errors || [],
    });
  }

  return response;
}

module.exports = {
  buildDecisionResponse,
  assertTraceIntegrity,
};

