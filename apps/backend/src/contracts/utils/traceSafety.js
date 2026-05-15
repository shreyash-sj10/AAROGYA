/**
 * Trace Safety Utility
 * Centralizes Trace_v1 integrity and defensive recovery logic.
 * Ensures every response (success or failure) contains a schema-compliant trace.
 */

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, toSafeNumber(value, min)));
}

/**
 * Builds a 100% schema-compliant Trace_v1 skeleton with safe defaults.
 */
function buildSafeSkeleton(traceId, timestamp) {
  const safeTraceId = toSafeString(traceId, "unknown_trace");
  const now = Math.max(0, Math.floor(timestamp || Date.now()));

  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: safeTraceId,
    timestamp: now,
    stages: {
      interpretation_layer: {
        ml_used: false,
        ml_confidence: 0,
        ml_contribution_weight: 0,
      },
      candidate_generator: {
        input_count: 0,
        output_count: 0,
      },
      constraint_engine: {
        input_count: 0,
        output_count: 0,
        rejected: 0,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      },
      scoring_engine: {
        input_count: 0,
        output_count: 0,
      },
      diversity_engine: {
        input_count: 0,
        output_count: 0,
      },
      optimizer: {
        input_count: 0,
        output_count: 0,
        combinations_evaluated: 0,
        selected_score: 0,
      },
      reliability_engine: {
        input_count: 0,
        output_count: 0,
      },
    },
  };
}

/**
 * Merges a partial trace with a safe skeleton to ensure schema compliance.
 * This is the "Safe" version of the trace (schema-safe, but not transition-healed).
 */
function ensureValidTrace(inputTrace, traceId, timestamp) {
  const safeInput = toSafeObject(inputTrace);
  const skeleton = buildSafeSkeleton(
    toSafeString(safeInput.trace_id, traceId),
    toSafeNumber(safeInput.timestamp, timestamp)
  );

  const inputStages = toSafeObject(safeInput.stages);

  const mergedTrace = {
    ...skeleton,
    stages: {
      interpretation_layer: {
        ...skeleton.stages.interpretation_layer,
        ...toSafeObject(inputStages.interpretation_layer),
      },
      candidate_generator: {
        ...skeleton.stages.candidate_generator,
        ...toSafeObject(inputStages.candidate_generator),
      },
      constraint_engine: {
        ...skeleton.stages.constraint_engine,
        ...toSafeObject(inputStages.constraint_engine),
      },
      scoring_engine: {
        ...skeleton.stages.scoring_engine,
        ...toSafeObject(inputStages.scoring_engine),
      },
      diversity_engine: {
        ...skeleton.stages.diversity_engine,
        ...toSafeObject(inputStages.diversity_engine),
      },
      optimizer: {
        ...skeleton.stages.optimizer,
        ...toSafeObject(inputStages.optimizer),
      },
      reliability_engine: {
        ...skeleton.stages.reliability_engine,
        ...toSafeObject(inputStages.reliability_engine),
      },
    },
  };

  const stages = mergedTrace.stages;
  
  // Interpretation layer constraints
  stages.interpretation_layer.ml_used = Boolean(stages.interpretation_layer.ml_used);
  stages.interpretation_layer.ml_confidence = clamp(stages.interpretation_layer.ml_confidence, 0, 1);
  stages.interpretation_layer.ml_contribution_weight = clamp(stages.interpretation_layer.ml_contribution_weight, 0, 0.4);

  // Stage field normalization only (no transition healing/mutation)
  const stageOrder = [
    "candidate_generator", 
    "constraint_engine", 
    "scoring_engine", 
    "diversity_engine", 
    "optimizer", 
    "reliability_engine"
  ];

  stageOrder.forEach((stageName, index) => {
    const stage = stages[stageName];
    stage.input_count = Math.max(0, Math.trunc(toSafeNumber(stage.input_count, 0)));
    stage.output_count = Math.max(0, Math.trunc(toSafeNumber(stage.output_count, 0)));

  });

  stages.constraint_engine.rejected = Math.max(0, Math.trunc(toSafeNumber(stages.constraint_engine.rejected, 0)));
  stages.constraint_engine.p0_rules_checked = Math.max(0, Math.trunc(toSafeNumber(stages.constraint_engine.p0_rules_checked, 0)));
  stages.constraint_engine.p0_violations = Math.max(0, Math.trunc(toSafeNumber(stages.constraint_engine.p0_violations, 0)));
  stages.constraint_engine.p0_violated_rule_ids = toSafeArray(stages.constraint_engine.p0_violated_rule_ids)
    .map(id => toSafeString(id))
    .filter(Boolean);
  stages.constraint_engine.rules = toSafeArray(stages.constraint_engine.rules).map(rule => {
    const safeRule = toSafeObject(rule);
    return {
      rule_id: toSafeString(safeRule.rule_id, "unknown_rule"),
      action: safeRule.action === "reject" ? "reject" : "penalize",
      reason: toSafeString(safeRule.reason, "rule matched"),
    };
  });

  stages.optimizer.combinations_evaluated = Math.max(0, Math.trunc(toSafeNumber(stages.optimizer.combinations_evaluated, 0)));
  stages.optimizer.selected_score = clamp(stages.optimizer.selected_score, 0, 1);

  return mergedTrace;
}

/**
 * Captures a raw, unhealed trace from input stats.
 * Only basic normalization (types/clamping) is applied to keep it compliant with Trace_v1 structure.
 */
function buildMinimalTrace(inputTrace, traceId, timestamp) {
  // Raw trace is primary, but still normalized to remain Trace_v1 schema-compliant.
  // No transition healing is performed.
  return ensureValidTrace(inputTrace, traceId, timestamp);
}

/**
 * Builds a dual-view trace containing both the raw execution and a schema-safe trace.
 * Raw execution is primary at the root to preserve proof integrity.
 */
function buildDualTrace(inputTrace, traceId, timestamp) {
  const safeTrace = ensureValidTrace(inputTrace, traceId, timestamp);
  const executionTrace = buildMinimalTrace(inputTrace, traceId, timestamp);

  return {
    ...executionTrace,
    execution: executionTrace,
    safe: safeTrace,
  };
}

module.exports = {
  buildSafeSkeleton,
  ensureValidTrace,
  buildMinimalTrace,
  buildDualTrace,
};

