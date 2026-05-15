const { _runPipelineInternal } = require("./pipeline");
const { buildDecisionResponse } = require("../../contracts/builders/decisionResponse.builder");
const { validateDecisionRequest } = require("../../contracts/validators");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { generateExplanationWithAI } = require("../../modules/explanation/explanationEngine");
const { recordRequest, recordError, recordAIDisagreement, getSnapshot } = require("../../observability/metrics");
const { logRequestStart, logRequestEnd, logError } = require("../../observability/logger");
const { getRequestContext } = require("../../observability/requestContext");
const { getRecentMeals } = require("../../repositories/history.repository");
const { persistPostPlanArtifacts } = require("../../services/db/planDecisionPersistence");
const { getMLInterpretation } = require("../../services/ml/interpretationClient");
const { getUserWeightsAsync } = require("../../modules/adaptive/userPreference.repository");
const { toSafeString, toSafeNumber } = require("../../utils/normalizeInput");
const { computeAdaptiveScore } = require("../../modules/adaptive/adaptiveScore.engine");
const { getFoodsSource } = require("../../repositories/food.repository");
const { getRulesSource } = require("../../repositories/rule.repository");
const { getTemplatesSource } = require("../../repositories/template.repository");

const AI_FORBIDDEN_KEYS = new Set([
  "meal",
  "selection",
  "recipe_id",
  "recipe_ids",
  "ranking",
  "selected_meal",
  "selected_recipes",
]);

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function assertRuntimeDataSources() {
  const sources = {
    foods: getFoodsSource(),
    rules: getRulesSource(),
    templates: getTemplatesSource(),
  };

  const fallbackKeys = Object.keys(sources).filter((key) => String(sources[key]).toLowerCase() !== "db");
  if (fallbackKeys.length > 0) {
    console.warn(`[WARNING] fallback in production path: ${fallbackKeys.join(", ")}`);
    if (process.env.REQUIRE_DB === "true") {
      throw new ContractViolationError("Fallback blocked by REQUIRE_DB", {
        source: "orchestrator",
        fallback_sources: fallbackKeys,
      });
    }
  }
}

function validateAdaptiveActivation() {
  const probeFood = {
    id: "adaptive_probe_rice",
    recipe_id: "adaptive_probe_rice",
    name: "Basmati Rice",
  };

  const likeScore = computeAdaptiveScore(probeFood, {
    user_history: { liked_foods: ["Basmati Rice"] },
  });
  const dislikeScore = computeAdaptiveScore(probeFood, {
    user_history: { disliked_foods: ["Basmati Rice"] },
  });
  const active = likeScore !== dislikeScore;

  console.info(`[ADAPTIVE] ${active ? "active" : "inactive"} like=${likeScore} dislike=${dislikeScore}`);
  return active;
}

function normalizeMealType(value) {
  const normalized = toSafeString(value, "").toLowerCase();
  if (normalized === "breakfast" || normalized === "lunch" || normalized === "dinner") {
    return normalized;
  }
  return "lunch";
}

function normalizeSeason(value) {
  const normalized = toSafeString(value, "").toLowerCase();
  if (normalized === "summer" || normalized === "winter" || normalized === "monsoon") {
    return normalized;
  }
  return "summer";
}

function normalizeDietType(value) {
  const normalized = toSafeString(value, "").toLowerCase();
  if (normalized === "vegan") {
    return "vegan";
  }
  return "vegetarian";
}

function normalizeStringArray(value) {
  return toSafeArray(value)
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDosha(value) {
  const safe = toSafeObject(value);
  const vata = Math.max(0, toSafeNumber(safe.vata, 0));
  const pitta = Math.max(0, toSafeNumber(safe.pitta, 0));
  const kapha = Math.max(0, toSafeNumber(safe.kapha, 0));
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return { vata: 0.333333, pitta: 0.333333, kapha: 0.333334 };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));
  return { vata: nv, pitta: np, kapha: Number((1 - nv - np).toFixed(6)) };
}

function resolveResponseVersions(input) {
  const safeInput = toSafeObject(input);
  const safeMeta = toSafeObject(safeInput.meta);

  return {
    model_version: toSafeString(
      safeMeta.model_version || process.env.AAROGYA_AI_MODEL_VERSION,
      "assistive_offline_v1"
    ),
    prompt_version: toSafeString(
      safeMeta.prompt_version || process.env.AAROGYA_AI_PROMPT_VERSION,
      "prompt_v1"
    ),
    rules_version: toSafeString(
      safeInput.rules_version || safeMeta.rules_version || process.env.AAROGYA_RULES_VERSION,
      "rules_v1"
    ),
  };
}

function extractAISuggestion(input) {
  const safeInput = toSafeObject(input);
  const safeMeta = toSafeObject(safeInput.meta);
  const safeAIProfile = toSafeObject(safeInput.aiProfile);

  const candidate =
    safeMeta.ai_suggestion
    || safeInput.ai_suggestion
    || safeAIProfile.suggestion
    || safeAIProfile.meal
    || safeAIProfile.selected_recipe
    || safeAIProfile.selected_recipes;

  if (Array.isArray(candidate)) {
    return candidate
      .map((item) => toSafeString(item, ""))
      .filter(Boolean);
  }

  const asString = toSafeString(candidate, "");
  return asString || "";
}

function throwOnInvalidValidation(validationResult, contractName) {
  const safeValidation = toSafeObject(validationResult);
  if (safeValidation.valid) {
    return;
  }

  throw new ContractViolationError(`${contractName} validation failed`, {
    contract: contractName,
    errors: toSafeArray(safeValidation.errors),
  });
}

function assertNoAIDecisionLeak(obj) {
  function scan(value, path) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }

    Object.keys(value).forEach((key) => {
      const normalizedKey = String(key).trim().toLowerCase();
      const nextPath = path ? `${path}.${key}` : key;
      if (AI_FORBIDDEN_KEYS.has(normalizedKey)) {
        throw new ContractViolationError("AI boundary violation: forbidden decision field", {
          source: "orchestrator",
          field: key,
          path: nextPath,
        });
      }
      scan(value[key], nextPath);
    });
  }

  scan(obj, "ai_output");
}

function parseStrictCount(value, key, source) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ContractViolationError("Trace integrity violation: invalid stage count", {
      source,
      key,
      value,
    });
  }

  return value;
}

function assertStageTransitions(stageStats) {
  const stages = toSafeObject(stageStats);
  const candidate = toSafeObject(stages.candidate_generator);
  const constraint = toSafeObject(stages.constraint_engine);
  const scoring = toSafeObject(stages.scoring_engine);
  const diversity = toSafeObject(stages.diversity_engine);
  const optimizer = toSafeObject(stages.optimizer);
  const reliability = toSafeObject(stages.reliability_engine);

  const transitions = [
    { link: "candidate_generator->constraint_engine", prev: candidate.output_count, next: constraint.input_count },
    { link: "constraint_engine->scoring_engine", prev: constraint.output_count, next: scoring.input_count },
    { link: "scoring_engine->diversity_engine", prev: scoring.output_count, next: diversity.input_count },
    { link: "diversity_engine->optimizer", prev: diversity.output_count, next: optimizer.input_count },
    { link: "optimizer->reliability_engine", prev: optimizer.output_count, next: reliability.input_count },
  ];

  transitions.forEach((transition) => {
    const prev = parseStrictCount(transition.prev, `${transition.link}.prev`, "orchestrator");
    const next = parseStrictCount(transition.next, `${transition.link}.next`, "orchestrator");
    if (prev !== next) {
      throw new ContractViolationError("Trace integrity violation between stages", {
        source: "orchestrator",
        link: transition.link,
        previous_output_count: prev,
        next_input_count: next,
      });
    }
  });
}

function buildDecisionRequestPayload(input) {
  const safeInput = toSafeObject(input);
  const safeUserState = toSafeObject(safeInput.userState);
  const safeContext = toSafeObject(safeUserState.context);
  const safeConstraints = toSafeObject(safeInput.constraints);
  const safeMeta = toSafeObject(safeInput.meta);

  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: toSafeString(safeInput.request_id || safeInput.requestId, "orchestrator_request"),
    trace_id: toSafeString(safeInput.trace_id || safeInput.traceId, "orchestrator_trace"),
    user_state: {
      user_id: toSafeString(safeUserState.user_id || safeUserState.userId, "anonymous"),
      goals: normalizeStringArray(safeUserState.goals || safeUserState.goal_vector),
      risk_flags: normalizeStringArray(safeUserState.risk_flags),
      symptoms: normalizeStringArray(safeUserState.symptoms),
      dosha_estimate: normalizeDosha(safeUserState.dosha_estimate),
      allergies: normalizeStringArray(safeUserState.allergies),
      preferences: normalizeStringArray(safeUserState.preferences),
      context: {
        meal_type: normalizeMealType(safeContext.meal_type || safeContext.mealType || safeInput.mealType),
        season: normalizeSeason(safeContext.season),
      },
    },
    constraints: {
      max_calories: Math.max(0, toSafeNumber(safeConstraints.max_calories, 0)),
      diet_type: normalizeDietType(safeConstraints.diet_type || safeUserState.diet_type || safeUserState.diet),
    },
    meta: {
      timestamp: Number.isInteger(safeMeta.timestamp) ? safeMeta.timestamp : 0,
      request_source: toSafeString(safeMeta.request_source, "orchestrator"),
      cache_allowed: typeof safeMeta.cache_allowed === "boolean" ? safeMeta.cache_allowed : false,
    },
  };
}

async function executeGeneratePlanCore(input) {
  const startedAt = Date.now();
  const safeInput = toSafeObject(input);
  let request = null;
  let userId = "anonymous";
  let outcomeStatus = "error";

  try {
    assertNoAIDecisionLeak(toSafeObject(safeInput.aiProfile));

    request = buildDecisionRequestPayload(safeInput);
    throwOnInvalidValidation(validateDecisionRequest(request), "DecisionRequest_v1");
    assertRuntimeDataSources();
    userId = toSafeString(toSafeObject(safeInput.userState).user_id || toSafeObject(safeInput.userState).userId, "anonymous");

    logRequestStart({
      request_id: request.request_id,
      trace_id: request.trace_id,
      user_id: userId,
      intent: "GENERATE_PLAN",
    });

    let persistentHistory = [];
    try {
      persistentHistory = await getRecentMeals(userId);
    } catch (historyError) {
      const message = historyError instanceof Error ? historyError.message : String(historyError || "unknown");
      console.warn(`[Orchestrator] History unavailable, proceeding without DB history: ${message}`);
      persistentHistory = [];
    }
    const providedHistory = toSafeArray(toSafeObject(safeInput.context).history);
    const mergedHistory = [...providedHistory, ...toSafeArray(persistentHistory)];

    // Call ML Interpretation asynchronously if a query or symptoms are present
    const query = toSafeString(safeInput.query || toSafeObject(safeInput.meta).query || toSafeArray(toSafeObject(safeInput.userState).symptoms).join(" "));
    const mlInterpretation = query ? await getMLInterpretation(query, {
      request_id: request.request_id,
      trace_id: request.trace_id
    }) : null;

    const adaptiveWeights = await getUserWeightsAsync(userId);
    const hydratedUserState = {
      ...toSafeObject(safeInput.userState),
      adaptive_weights: toSafeObject(adaptiveWeights),
    };

    const pipelineResult = _runPipelineInternal({
      mealType: normalizeMealType(safeInput.mealType || toSafeObject(toSafeObject(safeInput.userState).context).meal_type),
      foods: toSafeArray(safeInput.foods),
      rules: toSafeArray(safeInput.rules),
      userState: hydratedUserState,
      userHistory: toSafeObject(safeInput.userHistory),
      constraints: toSafeObject(safeInput.constraints),
      mlInterpretation, // Passed to pipeline for deterministic merge
      meta: {
        trace_id: request.trace_id,
        timestamp: request.meta.timestamp,
      },
      context: {
        ...toSafeObject(safeInput.context),
        history: mergedHistory,
      },
    });

    const stageStats = toSafeObject(pipelineResult.stageStats);
    assertStageTransitions(stageStats);

    const reliability = toSafeObject(pipelineResult.reliability);

    const explanation = await generateExplanationWithAI({
      meal: toSafeArray(reliability.mealPlan).map((item) => toSafeObject(item).name).filter(Boolean),
      score: toSafeNumber(reliability.score, 0),
      breakdown: toSafeObject(reliability.breakdown),
    }, toSafeObject(safeInput.userState), {
      relaxation_applied: Boolean(toSafeObject(reliability.meta).fallback_used),
      ml_used: Boolean(toSafeObject(toSafeObject(pipelineResult.stageStats).interpretation_layer).ml_used),
    });

    const responseVersions = resolveResponseVersions(safeInput);
    const requestMeta = toSafeObject(request.meta);
    const traceTimestamp = Number.isInteger(requestMeta.timestamp)
      ? requestMeta.timestamp
      : Math.max(0, Math.floor(Date.now() / 1000));

    const fallbackReason = toSafeString(toSafeObject(reliability.meta).fallback_reason, "");
    const baseWarnings = toSafeArray(toSafeObject(explanation).warnings);
    const warnings = !fallbackReason || fallbackReason === "SAFE_P0_ONLY"
      ? baseWarnings
      : [...baseWarnings, JSON.stringify({ reason: fallbackReason })];

    const response = buildDecisionResponse({
      request: {
        request_id: request.request_id,
        trace_id: request.trace_id,
        meta: { timestamp: traceTimestamp },
      },
      internal: {
        mealPlan: toSafeArray(reliability.mealPlan),
        score: toSafeNumber(reliability.score, 0),
        nutrition_summary: toSafeObject(reliability.nutrition_summary),
        confidence: toSafeObject(reliability.confidence),
        explanation: {
          deterministic: toSafeString(toSafeObject(explanation).deterministic, "Meal selected by deterministic engine."),
          ai_explanation: toSafeString(toSafeObject(explanation).ai_explanation, ""),
          citations: toSafeArray(toSafeObject(explanation).citations),
        },
        insights: toSafeArray(toSafeObject(explanation).highlights),
        warnings,
        meta: {
          latency_ms: Math.max(0, Date.now() - startedAt),
          cache_hit: false,
          model_version: responseVersions.model_version,
          prompt_version: responseVersions.prompt_version,
          rules_version: responseVersions.rules_version,
        },
      },
      stageStats,
    });

    const aiSuggestion = extractAISuggestion(safeInput);
    const finalDecision = toSafeArray(response.meal_plan).map((item) => toSafeObject(item).recipe_id);
    recordAIDisagreement({
      ai_suggestion: aiSuggestion,
      final_decision: finalDecision,
    });

    const safeTimings = toSafeObject(pipelineResult.timings);
    const relMetaForMetrics = toSafeObject(reliability.meta);
    const ceForMetrics = toSafeObject(stageStats.constraint_engine);
    recordRequest({
      latency_ms: toSafeNumber(toSafeObject(response.meta).latency_ms, 0),
      pipeline_ms: toSafeNumber(safeTimings.pipeline_ms, 0),
      optimizer_ms: toSafeNumber(safeTimings.optimizer_ms, 0),
      candidate_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stageStats.optimizer).input_count, 0))),
      usedFallback: Boolean(relMetaForMetrics.fallback_used),
      confidenceLevel: toSafeString(toSafeObject(response.confidence).level, "low"),
      score: toSafeNumber(response.score, 0),
      confidenceValue: toSafeNumber(toSafeObject(response.confidence).value, 0),
      p0_violations: Math.max(0, Math.trunc(toSafeNumber(ceForMetrics.p0_violations, 0))),
      relaxation_level: Math.max(0, Math.trunc(toSafeNumber(relMetaForMetrics.relaxation_level, 0))),
      fallback_reason: toSafeString(relMetaForMetrics.fallback_reason, ""),
    });

    // Issue 2: Await storage for strict determinism across close calls
    try {
      const persisted = await persistPostPlanArtifacts({
        userId,
        mealPlan: response.meal_plan,
        category: request.user_state.context.meal_type,
        decision: {
          request_id: response.request_id,
          trace_id: response.trace_id,
          request_payload: request,
          response_payload: response,
          execution_trace: toSafeObject(response.trace),
          safe_trace: toSafeObject(toSafeObject(response.trace).stages),
        },
      });
      if (!persisted.ok) {
        console.warn(`[Orchestrator] Post-plan persistence failed: ${persisted.reason}`);
      }
    } catch (err) {
      console.warn(`[Orchestrator] Audit storage failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    outcomeStatus = "ok";
    return response;
  } catch (error) {
    const ctx = getRequestContext();
    const rid = request?.request_id || ctx.requestId || "unknown_request";
    const tid = request?.trace_id || "unknown_trace";
    const errType = error instanceof ContractViolationError ? "SCHEMA_VALIDATION_FAILED" : "SYSTEM_ERROR";
    logError({
      request_id: rid,
      trace_id: tid,
      user_id: userId,
      intent: "GENERATE_PLAN",
      error_type: errType,
      message: error instanceof Error ? error.message : String(error || "unknown"),
      failureReason: error instanceof Error ? error.message : String(error || "unknown"),
    });

    if (error instanceof ContractViolationError) {
      recordError("SCHEMA_VALIDATION_FAILED");
    } else {
      recordError("SYSTEM_ERROR");
    }
    throw error;
  } finally {
    const ctx = getRequestContext();
    const rid = request?.request_id || ctx.requestId || "unknown_request";
    const tid = request?.trace_id || "unknown_trace";
    logRequestEnd({
      request_id: rid,
      trace_id: tid,
      user_id: userId,
      intent: "GENERATE_PLAN",
      latency_ms: Date.now() - startedAt,
      status: outcomeStatus,
    });
  }
}

async function generateMealPlan(input) {
  return executeGeneratePlanCore(input);
}

function getDashboardData() {
  return getSnapshot();
}

module.exports = {
  generateMealPlan,
  executeGeneratePlanCore,
  getDashboardData,
  ContractViolationError,
  assertNoAIDecisionLeak,
  validateAdaptiveActivation,
};
























