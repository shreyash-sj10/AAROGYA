const { normalizeUserHistory, normalizeUserState, toSafeArray } = require("../../utils/normalizeInput");
const { getBestTemplate } = require("../../templates/mealTemplate.service");
const { generateCandidates } = require("../../modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../modules/constraint/constraintEngine");
const { scoreCandidates } = require("../../modules/scoring/scoringEngine");
const { applyDiversity } = require("../../modules/diversity/diversityEngine");
const { optimizeMeal } = require("../../modules/optimizer/optimizer");
const { applyReliability } = require("../../modules/reliability/reliabilityEngine");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

// INTERNAL ONLY - DO NOT USE OUTSIDE ORCHESTRATOR
function runPipeline(input) {
  const pipelineStartedAt = process.hrtime.bigint();
  const safeInput = toSafeObject(input);
  const normalizedUserState = normalizeUserState(safeInput.userState);
  const mealType = typeof safeInput.mealType === "string" ? safeInput.mealType.trim() : "";
  const foods = toSafeArray(safeInput.foods);
  const rules = toSafeArray(safeInput.rules);
  const normalizedUserHistory = normalizeUserHistory(safeInput.userHistory);

  if (!mealType) {
    throw new Error("runPipeline requires a valid mealType.");
  }

  const template = getBestTemplate(mealType);
  if (!template) {
    throw new Error(`No template found for meal type "${mealType}".`);
  }

  const candidates = generateCandidates(template, foods, normalizedUserState, rules);
  const constrained = applyConstraints(template, candidates, normalizedUserState, rules);
  const scored = scoreCandidates(constrained, normalizedUserState, template);
  const diversified = applyDiversity(scored, normalizedUserHistory);

  const optimizerStartedAt = process.hrtime.bigint();
  const mealResult = optimizeMeal(template, diversified);
  const optimizerElapsedMs = Number(process.hrtime.bigint() - optimizerStartedAt) / 1e6;

  const reliability = applyReliability({
    mealType,
    template,
    userState: normalizedUserState,
    foods,
    rules,
    userHistory: normalizedUserHistory,
    candidates,
    constrainedCandidates: constrained,
    scoredCandidates: scored,
    diversifiedCandidates: diversified,
    mealResult,
    optimizerStats: readStageStats(mealResult, "optimizer"),
  });

  const candidateStats = readStageStats(candidates, "candidate_generator");
  const constraintStats = readStageStats(constrained, "constraint_engine");
  const scoringStats = readStageStats(scored, "scoring_engine");
  const diversityStats = readStageStats(diversified, "diversity_engine");
  const optimizerStats = readStageStats(mealResult, "optimizer");
  const reliabilityStats = readStageStats(reliability, "reliability_engine");

  const stageStats = {
    candidate_generator: {
      input_count: candidateStats.inputCount,
      output_count: candidateStats.outputCount,
    },
    constraint_engine: {
      input_count: constraintStats.inputCount,
      output_count: constraintStats.outputCount,
      rejected: constraintStats.rejectedCount,
      rules: toSafeArray(toSafeObject(reliability.traceExtension).constraint_rules),
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
    },
  };

  const pipelineElapsedMs = Number(process.hrtime.bigint() - pipelineStartedAt) / 1e6;

  return {
    template,
    candidates,
    constrained,
    scored,
    diversified,
    mealResult,
    reliability,
    stageStats,
    timings: {
      pipeline_ms: Number(pipelineElapsedMs.toFixed(3)),
      optimizer_ms: Number(optimizerElapsedMs.toFixed(3)),
    },
  };
}

if (require.main === module) {
  throw new Error("Pipeline cannot be executed directly");
}

module.exports = {
  _runPipelineInternal: runPipeline,
};


