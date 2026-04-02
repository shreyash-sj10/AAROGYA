const { _runPipelineInternal } = require("./pipeline");
const { validateDecisionRequest } = require("../../contracts/validators/validateDecisionRequest");
const { validateTrace } = require("../../contracts/validators/validateTrace");
const { buildDecisionResponse } = require("../../contracts/builders/decisionResponse.builder");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { generateExplanation } = require("../../modules/explanation/explanationEngine");
const { recordRequest, recordError, recordAIDisagreement, getSnapshot } = require("../../observability/metrics");

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

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
      safeMeta.model_version || process.env.AYUDIET_AI_MODEL_VERSION,
      "assistive_offline_v1"
    ),
    prompt_version: toSafeString(
      safeMeta.prompt_version || process.env.AYUDIET_AI_PROMPT_VERSION,
      "prompt_v1"
    ),
    rules_version: toSafeString(
      safeInput.rules_version || safeMeta.rules_version || process.env.AYUDIET_RULES_VERSION,
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

function executeGeneratePlanCore(input) {
  const startedAt = Date.now();
  const safeInput = toSafeObject(input);

  try {
    assertNoAIDecisionLeak(toSafeObject(safeInput.aiProfile));

    const request = buildDecisionRequestPayload(safeInput);
    throwOnInvalidValidation(validateDecisionRequest(request), "DecisionRequest_v1");

    const pipelineResult = _runPipelineInternal({
      mealType: normalizeMealType(safeInput.mealType || toSafeObject(toSafeObject(safeInput.userState).context).meal_type),
      foods: toSafeArray(safeInput.foods),
      rules: toSafeArray(safeInput.rules),
      userState: toSafeObject(safeInput.userState),
      userHistory: toSafeObject(safeInput.userHistory),
    });

    const stageStats = toSafeObject(pipelineResult.stageStats);
    assertStageTransitions(stageStats);

    const reliability = toSafeObject(pipelineResult.reliability);

    const explanation = generateExplanation({
      meal: toSafeArray(reliability.mealPlan).map((item) => toSafeObject(item).name).filter(Boolean),
      score: toSafeNumber(reliability.score, 0),
      breakdown: toSafeObject(reliability.breakdown),
    }, toSafeObject(safeInput.userState), {
      relaxation_applied: Boolean(toSafeObject(reliability.meta).fallback_used),
    });

    const responseVersions = resolveResponseVersions(safeInput);

    const response = buildDecisionResponse({
      request,
      internal: {
        mealPlan: toSafeArray(reliability.mealPlan),
        score: toSafeNumber(reliability.score, 0),
        breakdown: toSafeObject(reliability.breakdown),
        nutrition_summary: toSafeObject(reliability.nutrition_summary),
        confidence: toSafeObject(reliability.confidence),
        explanation: {
          deterministic: toSafeString(toSafeObject(explanation).deterministic, "Meal selected by deterministic engine."),
          ai_explanation: "",
          citations: [],
        },
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

    throwOnInvalidValidation(validateTrace(response.trace), "Trace_v1");

    const aiSuggestion = extractAISuggestion(safeInput);
    const finalDecision = toSafeArray(response.meal_plan).map((item) => toSafeObject(item).recipe_id);
    recordAIDisagreement({
      ai_suggestion: aiSuggestion,
      final_decision: finalDecision,
    });

    const safeTimings = toSafeObject(pipelineResult.timings);
    recordRequest({
      latency_ms: toSafeNumber(toSafeObject(response.meta).latency_ms, 0),
      pipeline_ms: toSafeNumber(safeTimings.pipeline_ms, 0),
      optimizer_ms: toSafeNumber(safeTimings.optimizer_ms, 0),
      candidate_count: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(stageStats.optimizer).input_count, 0))),
      usedFallback: Boolean(toSafeObject(reliability.meta).fallback_used),
      confidenceLevel: toSafeString(toSafeObject(response.confidence).level, "low"),
    });

    return response;
  } catch (error) {
    if (error instanceof ContractViolationError) {
      recordError("SCHEMA_VALIDATION_FAILED");
    } else {
      recordError("SYSTEM_ERROR");
    }
    throw error;
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
};



