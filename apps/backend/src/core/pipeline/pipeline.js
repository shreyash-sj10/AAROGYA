const { normalizePipelineContext, normalizeUserHistory, normalizeUserState, normalizeString, toSafeArray, toSafeNumber } = require("../../utils/normalizeInput");
const { mergeInterpretation } = require("../../modules/interpretation/interpretationEngine");
const { getBestTemplate, extractCategories } = require("../../templates/mealTemplate.service");
const { generateCandidates } = require("../../modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../modules/constraint/constraintEngine");
const { scoreCandidates } = require("../../modules/scoring/scoringEngine");
const { applyDiversity } = require("../../modules/diversity/diversityEngine");
const { optimizeMeal } = require("../../modules/optimizer/optimizer");
const { applyRecipeScaling } = require("../../modules/recipe/recipeScaling.service");
const { applyReliability } = require("../../modules/reliability/reliabilityEngine");

const FAIL_LOUD_ON_EMPTY_CANDIDATES = process.env.AAROGYA_FAIL_LOUD_EMPTY_CANDIDATES === "true";

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureStageResult(stageName, result) {
  if (!result || typeof result !== "object") {
    throw new Error(`Pipeline stage returned invalid output: ${stageName}`);
  }
  return result;
}

function readStageStats(result, stageName) {
  const safeResult = toSafeObject(result);
  const stats = toSafeObject(safeResult.__stageStats);

  if (Object.keys(stats).length === 0) {
    throw new Error(`Missing __stageStats for ${stageName}`);
  }

  return {
    inputCount: Number.isInteger(stats.inputCount) ? stats.inputCount : 0,
    outputCount: Number.isInteger(stats.outputCount) ? stats.outputCount : 0,
    rejectedCount: Number.isInteger(stats.rejectedCount) ? stats.rejectedCount : 0,
    combinationsEvaluated: Number.isInteger(stats.combinationsEvaluated) ? stats.combinationsEvaluated : 0,
    selectedScore: typeof stats.selectedScore === "number" && Number.isFinite(stats.selectedScore) ? stats.selectedScore : 0,
    reason: typeof stats.reason === "string" ? stats.reason : "",
  };
}

function buildPipelineTrace(stageStats, meta = {}) {
  const safeMeta = toSafeObject(meta);
  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: typeof safeMeta.trace_id === "string" && safeMeta.trace_id.trim()
      ? safeMeta.trace_id.trim()
      : "pipeline_trace",
    timestamp: Number.isInteger(safeMeta.timestamp) ? safeMeta.timestamp : 0,
    stages: {
      interpretation_layer: toSafeObject(stageStats.interpretation_layer),
      candidate_generator: toSafeObject(stageStats.candidate_generator),
      constraint_engine: toSafeObject(stageStats.constraint_engine),
      scoring_engine: toSafeObject(stageStats.scoring_engine),
      diversity_engine: toSafeObject(stageStats.diversity_engine),
      optimizer: toSafeObject(stageStats.optimizer),
      reliability_engine: toSafeObject(stageStats.reliability_engine),
    },
  };
}

function getCategoryAvailability(template, foods) {
  const categories = Array.from(new Set(extractCategories(template)));
  const safeFoods = toSafeArray(foods);

  return categories.reduce((acc, category) => {
    acc[category] = safeFoods.reduce((count, food) => {
      const foodCategory = normalizeString(toSafeObject(food).category);
      return count + (foodCategory === category ? 1 : 0);
    }, 0);
    return acc;
  }, {});
}

function readExclusions(userState) {
  const safeUserState = toSafeObject(userState);
  return toSafeArray(safeUserState.exclusions || safeUserState.preferences)
    .map(normalizeString)
    .filter(Boolean);
}

function buildZeroCandidateDiagnostics({ template, foods, userState, rules, candidateStats, constraintStats, constrained }) {
  const safeConstrainedStats = toSafeObject(toSafeObject(constrained).__stageStats);

  return {
    food_catalog_count: toSafeArray(foods).length,
    template_category_availability: getCategoryAvailability(template, foods),
    diet_type: normalizeString(toSafeObject(userState).diet_type || toSafeObject(userState).diet),
    exclusions: readExclusions(userState),
    p0_rules_checked: toSafeArray(rules).filter((rule) => toSafeObject(rule).priority === "P0").length,
    p0_violations: Number.isInteger(safeConstrainedStats.p0_violations) ? safeConstrainedStats.p0_violations : 0,
    p0_violated_rule_ids: Array.isArray(safeConstrainedStats.p0_violated_rule_ids) ? safeConstrainedStats.p0_violated_rule_ids : [],
    candidate_count: candidateStats.outputCount,
    valid_candidate_count: constraintStats.outputCount,
  };
}

// INTERNAL ONLY - DO NOT USE OUTSIDE ORCHESTRATOR
function runPipeline(input) {
  const pipelineStartedAt = process.hrtime.bigint();

  try {
    const safeInput = toSafeObject(input);
    let stageClock = process.hrtime.bigint();

    function lapMs() {
      const now = process.hrtime.bigint();
      const ms = Number(now - stageClock) / 1e6;
      stageClock = now;
      return Number(ms.toFixed(3));
    }

    const traceIdForLog = typeof toSafeObject(safeInput.meta).trace_id === "string"
      ? toSafeObject(safeInput.meta).trace_id.trim()
      : "";

    function logStageStructured(stageKey, stats, extras = {}, latencyOverride) {
      const { logPipelineStage } = require("../../observability/logger");
      console.info(`[Pipeline] ${stageKey} input_count=${stats.inputCount} output_count=${stats.outputCount}`);
      const ms = latencyOverride != null && Number.isFinite(Number(latencyOverride))
        ? Number(Number(latencyOverride).toFixed(3))
        : lapMs();
      logPipelineStage({
        stage: stageKey,
        latencyMs: ms,
        trace_id: traceIdForLog,
        input_count: stats.inputCount,
        output_count: stats.outputCount,
        rejected: stats.rejectedCount,
        ...extras,
      });
    }

    const normalizedUserState = normalizeUserState(safeInput.userState);
    const mealType = typeof safeInput.mealType === "string" ? safeInput.mealType.trim() : "";
    const foods = toSafeArray(safeInput.foods);
    const rules = toSafeArray(safeInput.rules);
    const normalizedUserHistory = normalizeUserHistory(safeInput.userHistory);
    const normalizedContext = normalizePipelineContext(safeInput.context);
    const normalizedConstraints = toSafeObject(safeInput.constraints);

    if (!mealType) {
      throw new Error("runPipeline requires a valid mealType.");
    }

    const template = getBestTemplate(mealType);
    if (!template) {
      throw new Error(`No template found for meal type "${mealType}".`);
    }

    const candidates = ensureStageResult("candidate_generator", generateCandidates(template, foods, normalizedUserState, rules));
    const candidateStats = readStageStats(candidates, "candidate_generator");
    logStageStructured("candidate_generator", candidateStats);

    // Interpretation Layer: Inserted before constraint stage as per requirements
    const interpretationResult = mergeInterpretation(normalizedUserState, safeInput.mlInterpretation, {
      mlWeight: toSafeNumber(toSafeObject(safeInput.meta).ml_weight, 0.3)
    });

    const { logPipelineStage } = require("../../observability/logger");
    logPipelineStage({
      stage: "interpretation_layer",
      latencyMs: lapMs(),
      trace_id: traceIdForLog,
      input_count: candidateStats.inputCount,
      output_count: candidateStats.outputCount,
      failureReason: interpretationResult.ml_used ? undefined : "deterministic_interpretation",
    });

    const interpretedUserState = {
      ...toSafeObject(interpretationResult.userState),
      context: {
        ...toSafeObject(toSafeObject(interpretationResult.userState).context),
        // Keep diet available to rule context so P0 dietary checks evaluate deterministically.
        diet_type: normalizeString(normalizedUserState.diet_type || normalizedUserState.diet),
      },
    };

    const constrained = ensureStageResult("constraint_engine", applyConstraints(template, candidates, interpretedUserState, rules));
    const constraintStats = readStageStats(constrained, "constraint_engine");
    const constraintStageEarly = toSafeObject(constrained.__stageStats || {});
    logStageStructured("constraint_engine", constraintStats, {
      p0_violations: Number.isInteger(constraintStageEarly.p0_violations) ? constraintStageEarly.p0_violations : 0,
    });

    if (candidateStats.outputCount === 0 || constraintStats.outputCount === 0) {
      const diagnostics = buildZeroCandidateDiagnostics({
        template,
        foods,
        userState: interpretedUserState,
        rules,
        candidateStats,
        constraintStats,
        constrained,
      });

      console.error("[Pipeline] Empty candidate pool diagnostics", diagnostics);

      if (FAIL_LOUD_ON_EMPTY_CANDIDATES) {
        throw new Error(`Pipeline fail-loud: no candidates before optimizer ${JSON.stringify(diagnostics)}`);
      }
    }

    const scored = ensureStageResult("scoring_engine", scoreCandidates(constrained, interpretedUserState, template));
    const scoringStats = readStageStats(scored, "scoring_engine");
    logStageStructured("scoring_engine", scoringStats);

    // Use context.history for persistent diversity
    const diversified = ensureStageResult("diversity_engine", applyDiversity(scored, {
      ...normalizedUserHistory,
      persistentHistory: normalizedContext.history
    }));
    const diversityStats = readStageStats(diversified, "diversity_engine");
    logStageStructured("diversity_engine", diversityStats);

    const optimizerStartedAt = process.hrtime.bigint();
    const mealResult = ensureStageResult("optimizer", optimizeMeal(template, diversified));
    const optimizerElapsedMs = Number(process.hrtime.bigint() - optimizerStartedAt) / 1e6;
    const optimizerStats = readStageStats(mealResult, "optimizer");
    logStageStructured("optimizer", optimizerStats, {}, optimizerElapsedMs);
    stageClock = process.hrtime.bigint();

    const scaledMealResult = ensureStageResult("recipe_scaling", applyRecipeScaling({
      mealResult,
      userState: interpretedUserState,
      constraints: normalizedConstraints,
      mealType,
    }));

    const reliability = ensureStageResult("reliability_engine", applyReliability({
      mealType,
      template,
      userState: interpretedUserState,
      foods,
      rules,
      userHistory: normalizedUserHistory,
      candidates,
      constrainedCandidates: constrained,
      scoredCandidates: scored,
      diversifiedCandidates: diversified,
      mealResult: scaledMealResult,
      optimizerStats,
    }));
    const reliabilityStats = readStageStats(reliability, "reliability_engine");
    const relMeta = toSafeObject(reliability.meta);
    logStageStructured("reliability_engine", reliabilityStats, {
      relaxation_level: Number.isInteger(relMeta.relaxation_level) ? relMeta.relaxation_level : Math.trunc(toSafeNumber(relMeta.relaxation_level, 0)),
    });

    // Read P0 stats directly from the constrained stage's non-enumerable __stageStats
    const constraintStageRaw = toSafeObject(constrained.__stageStats || {});

    const stageStats = {
      interpretation_layer: {
        ml_used: interpretationResult.ml_used,
        ml_confidence: interpretationResult.ml_confidence,
        ml_contribution_weight: interpretationResult.ml_contribution_weight,
      },
      candidate_generator: {
        input_count: candidateStats.inputCount,
        output_count: candidateStats.outputCount,
      },
      constraint_engine: {
        input_count: constraintStats.inputCount,
        output_count: constraintStats.outputCount,
        rejected: constraintStats.rejectedCount,
        rules: toSafeArray(toSafeObject(reliability.traceExtension).constraint_rules),
        p0_rules_checked: Number.isInteger(constraintStageRaw.p0_rules_checked) ? constraintStageRaw.p0_rules_checked : 0,
        p0_violations: Number.isInteger(constraintStageRaw.p0_violations) ? constraintStageRaw.p0_violations : 0,
        p0_violated_rule_ids: Array.isArray(constraintStageRaw.p0_violated_rule_ids) ? constraintStageRaw.p0_violated_rule_ids : [],
      },
      scoring_engine: {
        input_count: scoringStats.inputCount,
        output_count: scoringStats.outputCount,
      },
      diversity_engine: {
        input_count: diversityStats.inputCount,
        output_count: diversityStats.outputCount,
      },
      optimizer: {
        input_count: optimizerStats.inputCount,
        output_count: optimizerStats.outputCount,
        combinations_evaluated: optimizerStats.combinationsEvaluated,
        selected_score: optimizerStats.selectedScore,
      },
      reliability_engine: {
        input_count: reliabilityStats.inputCount,
        output_count: reliabilityStats.outputCount,
        relaxation_level: toSafeObject(reliability.meta).relaxation_level || 0,
        relaxed_priorities: Array.isArray(toSafeObject(reliability.meta).relaxed_priorities) ? toSafeObject(reliability.meta).relaxed_priorities : [],
        confidence_eval: toSafeObject(toSafeObject(reliability.traceExtension).confidence_eval),
      },
    };

    const pipelineElapsedMs = Number(process.hrtime.bigint() - pipelineStartedAt) / 1e6;
    const trace = buildPipelineTrace(stageStats, toSafeObject(safeInput.meta));

    return {
      template,
      candidates,
      constrained,
      scored,
      diversified,
      mealResult: scaledMealResult,
      reliability,
      stageStats,
      trace,
      timings: {
        pipeline_ms: Number(pipelineElapsedMs.toFixed(3)),
        optimizer_ms: Number(optimizerElapsedMs.toFixed(3)),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown_error");
    console.error(`[Pipeline] execution failed: ${message}`);
    throw error;
  }
}

function runPipelineLegacy(input) {
  const result = runPipeline(input);
  const meal = toSafeArray(result && result.mealResult && result.mealResult.meal);
  const score = toSafeNumber(result && result.mealResult && result.mealResult.score, 0);

  return {
    meal,
    score,
    explanation: "Deterministic pipeline selection",
  };
}

if (require.main === module) {
  throw new Error("Pipeline cannot be executed directly");
}

module.exports = {
  _runPipelineInternal: runPipeline,
  runPipeline: runPipelineLegacy,
};

