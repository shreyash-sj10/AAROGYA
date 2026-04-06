const { validateDecisionResponse } = require("../validators/validateDecisionResponse");
const { validateTrace } = require("../validators/validateTrace");
const { ContractViolationError } = require("../errors/ContractViolationError");
const { buildDualTrace, ensureValidTrace } = require("../utils/traceSafety");

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

function assertRequiredString(value, fieldName) {
  const normalized = toSafeString(value);
  if (!normalized) {
    throw new ContractViolationError(`Missing required field: ${fieldName}`, {
      contract: "DecisionResponse_v1",
    });
  }
  return normalized;
}

function assertRequiredNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ContractViolationError(`Missing or invalid required numeric field: ${fieldName}`, {
      contract: "DecisionResponse_v1",
    });
  }
  return value;
}

function normalizeMealPlan(mealPlan, isFallback) {
  if (!mealPlan || !Array.isArray(mealPlan)) {
    throw new ContractViolationError("Decision response requires meal_plan to be an array", {
      contract: "DecisionResponse_v1",
    });
  }

  if (mealPlan.length === 0) {
    if (isFallback) {
      return [];
    }
    throw new ContractViolationError("Decision response requires meal_plan to be a non-empty array", {
      contract: "DecisionResponse_v1",
    });
  }

  const normalized = mealPlan.map((entry, index) => {
    const safeEntry = toSafeObject(entry);
    const recipe_id = toSafeString(safeEntry.recipe_id || safeEntry.id || safeEntry.name, "");
    const name = toSafeString(safeEntry.name || safeEntry.recipe_id || safeEntry.id, "");

    if (!recipe_id) {
      throw new ContractViolationError(`Missing recipe_id in meal_plan at index ${index}`, {
        contract: "DecisionResponse_v1",
      });
    }

    if (!name) {
      throw new ContractViolationError(`Missing name in meal_plan at index ${index}`, {
        contract: "DecisionResponse_v1",
      });
    }

    return {
      recipe_id,
      name,
      quantity: normalizeQuantity(safeEntry.quantity),
    };
  });

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

function normalizeStringList(value) {
  return toSafeArray(value)
    .map((item) => toSafeString(item, ""))
    .filter(Boolean);
}

function normalizeExplanation(value) {
  const safe = toSafeObject(value);

  return {
    deterministic:
      toSafeString(safe.deterministic, "") || "Plan generated based on deterministic constraints.",
    ai_explanation: toSafeString(safe.ai_explanation, ""),
    citations: toSafeArray(safe.citations)
      .map((citation) => {
        const safeCitation = toSafeObject(citation);
        const text_id = toSafeString(safeCitation.text_id, "");
        const source = toSafeString(safeCitation.source, "");
        const chapter = toSafeString(safeCitation.chapter, "");
        if (!text_id || !source || !chapter) return null;
        return { text_id, source, chapter };
      })
      .filter(Boolean),
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

      if (key === "p0_violated_rule_ids" || key === "relaxed_priorities") {
        acc[key] = toSafeArray(safe[key]).filter((id) => typeof id === "string" && id.trim());
        return acc;
      }

      if (key === "confidence_eval") {
        const ce = toSafeObject(safe[key]);
        acc[key] = {
          relaxation_impact: clamp01(ce.relaxation_impact),
          pool_quality: clamp01(ce.pool_quality),
          score_confidence: clamp01(ce.score_confidence),
          penalty_impact: clamp01(ce.penalty_impact),
          diversity_impact: clamp01(ce.diversity_impact),
        };
        return acc;
      }

      if (key === "selected_score" || key === "diversity_penalty_applied") {
        acc[key] = Math.max(0, toSafeNumber(safe[key], defaults[key]));
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
  const refinementLoop = toSafeObject(safe.refinementLoop);

  const rawTrace = {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: assertRequiredString(safe.traceId, "trace_id"),
    timestamp: Math.max(0, Math.trunc(toSafeNumber(safe.timestamp, 0))),
    refinement_loop: Object.keys(refinementLoop).length > 0 ? {
      round: Math.max(0, toSafeNumber(refinementLoop.round, 0)),
      triggered_questions: toSafeArray(refinementLoop.triggered_questions),
      reason: toSafeString(refinementLoop.reason, ""),
      impact_on_confidence: toSafeNumber(refinementLoop.impact_on_confidence, 0)
    } : undefined,
    stages: {
      interpretation_layer: normalizeStage(stageStats.interpretation_layer, {
        ml_used: false,
        ml_confidence: 0,
        ml_contribution_weight: 0,
      }),
      candidate_generator: normalizeStage(stageStats.candidate_generator, {
        input_count: 0,
        output_count: 0,
      }),
      constraint_engine: normalizeStage(stageStats.constraint_engine, {
        input_count: 0,
        output_count: 0,
        rejected: 0,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      }),
      scoring_engine: normalizeStage(stageStats.scoring_engine, {
        input_count: 0,
        output_count: 0,
      }),
      diversity_engine: normalizeStage(stageStats.diversity_engine, {
        input_count: 0,
        output_count: 0,
        historical_matches_count: 0,
        diversity_penalty_applied: 0,
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
        relaxation_level: 0,
        relaxed_priorities: [],
        confidence_eval: {
          relaxation_impact: 1,
          pool_quality: 1,
          score_confidence: 1,
          penalty_impact: 1,
          diversity_impact: 1,
        },
      }),
    },
  };

  // Defensive layer: Ensure every trace is 100% schema compliant before final validation
  // and include the raw execution trace for observability.
  const trace = buildDualTrace(rawTrace, safe.traceId, safe.timestamp);

  // Still assert integrity on the "safe" version (which is at the root of the dual trace)
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

  if (typeof internal.score !== "number") {
    throw new ContractViolationError("Missing or invalid score field", { contract: "DecisionResponse_v1" });
  }
  const score = clamp01(internal.score);

  if (!internal.confidence || typeof internal.confidence !== "object" || Array.isArray(internal.confidence)) {
    throw new ContractViolationError("Missing or invalid confidence object", { contract: "DecisionResponse_v1" });
  }

  if (typeof internal.confidence.value !== "number") {
    throw new ContractViolationError("Missing or invalid confidence.value", { contract: "DecisionResponse_v1" });
  }

  const confidenceValue = clamp01(internal.confidence.value);
  const confidenceLevel = confidenceValue < 0.5 ? "low" : (confidenceValue < 0.8 ? "medium" : "high");

  const traceId = assertRequiredString(request.trace_id, "trace_id");
  const requestId = assertRequiredString(request.request_id, "request_id");

  const metaObj = toSafeObject(request.meta);
  if (typeof metaObj.timestamp !== "number") {
    throw new ContractViolationError("Missing required field: request.meta.timestamp", { contract: "DecisionResponse_v1" });
  }

  const dualTrace = buildTrace({
    traceId: traceId,
    timestamp: metaObj.timestamp,
    stageStats: safe.stageStats,
    refinementLoop: toSafeObject(safe.refinementLoop),
  });

  // Restore contract shape: trace MUST be ONLY the safe/healed Trace_v1 object
  const safeTrace = dualTrace.safe;

  const stageStats = toSafeObject(safe.stageStats);
  const isFallback = Boolean(
    toSafeNumber(toSafeObject(stageStats.optimizer).output_count, -1) === 0 ||
    toSafeNumber(toSafeObject(stageStats.reliability_engine).relaxation_level, 0) > 0
  );

  const response = {
    version: "DecisionResponse_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: requestId,
    trace_id: traceId,
    meal_plan: normalizeMealPlan(internal.mealPlan, isFallback),
    nutrition_summary: normalizeNutritionSummary(internal.nutrition_summary),
    score,
    confidence: {
      version: "Confidence_v1",
      schema_version: 1,
      compatibility: "backward",
      value: confidenceValue,
      level: confidenceLevel,
      components: {
        penalty_impact: typeof toSafeObject(internal.confidence.components).penalty_impact === "number" ? clamp01(internal.confidence.components.penalty_impact) : 1,
        diversity_impact: typeof toSafeObject(internal.confidence.components).diversity_impact === "number" ? clamp01(internal.confidence.components.diversity_impact) : 1,
        relaxation_impact: typeof toSafeObject(internal.confidence.components).relaxation_impact === "number" ? clamp01(internal.confidence.components.relaxation_impact) : 1,
      },
    },
    trace: safeTrace,
    explanation: normalizeExplanation(internal.explanation),
    insights: normalizeStringList(internal.insights),
    warnings: normalizeStringList(internal.warnings),
    meta: {
      latency_ms: assertRequiredNumber(toSafeObject(internal.meta).latency_ms, "meta.latency_ms"),
      cache_hit: Boolean(toSafeObject(internal.meta).cache_hit),
      model_version: assertRequiredString(toSafeObject(internal.meta).model_version, "meta.model_version"),
      prompt_version: assertRequiredString(toSafeObject(internal.meta).prompt_version, "meta.prompt_version"),
      rules_version: assertRequiredString(toSafeObject(internal.meta).rules_version, "meta.rules_version"),
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
