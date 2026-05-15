const { toSafeNumber, toSafeString } = require("../../utils/safeUtils");

const MAX_LATENCY_SAMPLES = Math.max(10, Number(process.env.AAROGYA_METRICS_LATENCY_SAMPLE_CAP || 1000));
const MAX_TREND_POINTS = Math.max(10, Number(process.env.AAROGYA_METRICS_TREND_CAP || 200));

const counters = {
  api_request_count: 0,
  api_error_count: 0,
  request_count: 0,
  total_latency: 0,
  total_pipeline_time: 0,
  total_optimizer_time: 0,
  total_candidate_count: 0,
  ai_fallback_count: 0,
  confidence_distribution: {
    low: 0,
    medium: 0,
    high: 0,
  },
  errors: {
    SCHEMA_VALIDATION_FAILED: 0,
    OPTIMIZER_FAILURE: 0,
    AI_FAILURE: 0,
    CACHE_ERROR: 0,
    CACHE_PARSE_ERROR: 0,
    SYSTEM_ERROR: 0,
  },
  last_request: {
    latency_ms: 0,
    pipeline_ms: 0,
    optimizer_ms: 0,
    candidate_count: 0,
    used_fallback: false,
    confidence_level: "low",
    p0_violations: 0,
    relaxation_level: 0,
    fallback_reason: "",
  },
  latency_samples: [],
  ai: {
    request_count: 0,
    response_count: 0,
    total_latency: 0,
    fallback_count: 0,
    schema_valid_count: 0,
    schema_invalid_count: 0,
    latency_histogram: {
      le_50ms: 0,
      le_100ms: 0,
      le_250ms: 0,
      le_500ms: 0,
      le_1000ms: 0,
      gt_1000ms: 0,
    },
  },
  ai_disagreement: {
    compared_count: 0,
    mismatch_count: 0,
  },
  trends: {
    score: [],
    confidence: [],
    fallback_rate: [],
  },
  adherence_events: [],
  engine: {
    p0_violation_plans_total: 0,
    relaxation_level_sum: 0,
    relaxation_samples: 0,
  },
  optimizer_search: {
    beam_layer_expansions_total: 0,
    beam_prune_events_total: 0,
  },
};

function clampLevel(value) {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return "low";
}

function buildAverage(total, count) {
  if (count <= 0) {
    return 0;
  }

  return Number((total / count).toFixed(3));
}

function clampRate(value) {
  return Number(Math.min(1, Math.max(0, toSafeNumber(value, 0))).toFixed(6));
}

function percentile(arr, p) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }

  const sorted = [...arr]
    .map((value) => Math.max(0, toSafeNumber(value, 0)))
    .sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, toSafeNumber(p, 0)));
  const index = Math.ceil((clamped / 100) * sorted.length) - 1;
  const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));

  return Number(sorted[safeIndex].toFixed(3));
}

function pushLatencySample(latencyMs) {
  counters.latency_samples.push(Math.max(0, toSafeNumber(latencyMs, 0)));
  if (counters.latency_samples.length > MAX_LATENCY_SAMPLES) {
    counters.latency_samples.shift();
  }
}

function pushTrendSample(collection, point) {
  collection.push(point);
  if (collection.length > MAX_TREND_POINTS) {
    collection.shift();
  }
}

function normalizeDecisionValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDecisionValue(item)).join("|").trim();
  }

  if (value && typeof value === "object") {
    if (typeof value.recipe_id === "string" && value.recipe_id.trim()) {
      return value.recipe_id.trim();
    }
    if (typeof value.id === "string" && value.id.trim()) {
      return value.id.trim();
    }
    if (typeof value.name === "string" && value.name.trim()) {
      return value.name.trim();
    }
  }

  return toSafeString(String(value || ""), "");
}

function bucketizeAILatency(latencyMs) {
  const value = Math.max(0, toSafeNumber(latencyMs, 0));

  if (value <= 50) {
    counters.ai.latency_histogram.le_50ms += 1;
    return;
  }

  if (value <= 100) {
    counters.ai.latency_histogram.le_100ms += 1;
    return;
  }

  if (value <= 250) {
    counters.ai.latency_histogram.le_250ms += 1;
    return;
  }

  if (value <= 500) {
    counters.ai.latency_histogram.le_500ms += 1;
    return;
  }

  if (value <= 1000) {
    counters.ai.latency_histogram.le_1000ms += 1;
    return;
  }

  counters.ai.latency_histogram.gt_1000ms += 1;
}

function recordApiRequest() {
  counters.api_request_count += 1;
}

function recordApiError() {
  counters.api_error_count += 1;
}

function recordRequest({
  latency_ms,
  pipeline_ms,
  optimizer_ms,
  candidate_count,
  usedFallback,
  confidenceLevel,
  score,
  confidenceValue,
  p0_violations,
  relaxation_level,
  fallback_reason,
} = {}) {
  const safeLatency = Math.max(0, toSafeNumber(latency_ms, 0));
  const safePipeline = Math.max(0, toSafeNumber(pipeline_ms, 0));
  const safeOptimizer = Math.max(0, toSafeNumber(optimizer_ms, 0));
  const safeCandidateCount = Math.max(0, Math.trunc(toSafeNumber(candidate_count, 0)));
  const level = clampLevel(confidenceLevel);

  counters.request_count += 1;
  counters.total_latency += safeLatency;
  counters.total_pipeline_time += safePipeline;
  counters.total_optimizer_time += safeOptimizer;
  counters.total_candidate_count += safeCandidateCount;

  pushLatencySample(safeLatency);

  if (usedFallback) {
    counters.ai_fallback_count += 1;
  }

  counters.confidence_distribution[level] += 1;
  const p0v = Math.max(0, Math.trunc(toSafeNumber(p0_violations, 0)));
  const relax = Math.max(0, Math.trunc(toSafeNumber(relaxation_level, 0)));
  const fbReason = toSafeString(fallback_reason, "");

  counters.last_request = {
    latency_ms: safeLatency,
    pipeline_ms: safePipeline,
    optimizer_ms: safeOptimizer,
    candidate_count: safeCandidateCount,
    used_fallback: Boolean(usedFallback),
    confidence_level: level,
    p0_violations: p0v,
    relaxation_level: relax,
    fallback_reason: fbReason,
  };

  counters.engine.relaxation_samples += 1;
  counters.engine.relaxation_level_sum += relax;
  if (p0v > 0) {
    counters.engine.p0_violation_plans_total += 1;
  }

  const timestamp = Date.now();
  const apiRequestCount = counters.api_request_count;
  pushTrendSample(counters.trends.score, {
    timestamp,
    value: clampRate(score),
  });
  pushTrendSample(counters.trends.confidence, {
    timestamp,
    value: clampRate(confidenceValue),
  });
  pushTrendSample(counters.trends.fallback_rate, {
    timestamp,
    value: apiRequestCount > 0 ? clampRate(counters.ai_fallback_count / apiRequestCount) : 0,
  });
}

function recordError(errorType = "SYSTEM_ERROR") {
  const key = toSafeString((typeof errorType === "string" ? errorType : "SYSTEM_ERROR").toUpperCase(), "SYSTEM_ERROR");
  if (!Object.prototype.hasOwnProperty.call(counters.errors, key)) {
    counters.errors.SYSTEM_ERROR += 1;
    return;
  }

  counters.errors[key] += 1;
}

function recordAIRequest() {
  counters.ai.request_count += 1;
}

function recordAIResponse(latencyMs = 0) {
  const safeLatency = Math.max(0, toSafeNumber(latencyMs, 0));
  counters.ai.response_count += 1;
  counters.ai.total_latency += safeLatency;
  bucketizeAILatency(safeLatency);
}

function recordAIValidation(valid) {
  if (valid) {
    counters.ai.schema_valid_count += 1;
    return;
  }

  counters.ai.schema_invalid_count += 1;
}

function recordAIFallback() {
  counters.ai.fallback_count += 1;
}

function recordOptimizerSearch({ beam_layer_expansions = 0, beam_prune_events = 0 } = {}) {
  counters.optimizer_search.beam_layer_expansions_total += Math.max(0, Math.trunc(toSafeNumber(beam_layer_expansions, 0)));
  counters.optimizer_search.beam_prune_events_total += Math.max(0, Math.trunc(toSafeNumber(beam_prune_events, 0)));
}

function recordAIDisagreement({ ai_suggestion, final_decision } = {}) {
  const aiDecision = normalizeDecisionValue(ai_suggestion);
  const finalDecision = normalizeDecisionValue(final_decision);

  if (!aiDecision || !finalDecision) {
    return;
  }

  counters.ai_disagreement.compared_count += 1;
  if (aiDecision !== finalDecision) {
    counters.ai_disagreement.mismatch_count += 1;
  }
}

function recordAdherenceEvent({ user_id, week_id, adherence_score, stats } = {}) {
  const safeUserId = toSafeString(user_id, "anonymous");
  const safeWeekId = toSafeString(week_id, "");
  const safeScore = clampRate(adherence_score);

  const event = {
    timestamp: Date.now(),
    user_id: safeUserId,
    week_id: safeWeekId,
    adherence_score: safeScore,
    stats: stats && typeof stats === "object" ? { ...stats } : {},
  };

  pushTrendSample(counters.adherence_events, event);
}

function getRecentTrend(points, limit = 5) {
  return points
    .slice(-Math.max(1, Math.trunc(toSafeNumber(limit, 5))))
    .map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
    }));
}

function getRecentAdherence(userId, limit = 10) {
  const safeUserId = toSafeString(userId, "");
  const filtered = safeUserId
    ? counters.adherence_events.filter((event) => event.user_id === safeUserId)
    : counters.adherence_events;

  return filtered
    .slice(-Math.max(1, Math.trunc(toSafeNumber(limit, 10))))
    .map((event) => ({ ...event }));
}

function getSnapshot() {
  const requestCount = counters.request_count;
  const aiValidations = counters.ai.schema_valid_count + counters.ai.schema_invalid_count;
  const p95Latency = percentile(counters.latency_samples, 95);
  const p99Latency = percentile(counters.latency_samples, 99);
  const apiRequestCount = counters.api_request_count;
  const fallbackRate = apiRequestCount > 0
    ? clampRate(counters.ai_fallback_count / apiRequestCount)
    : 0;
  const aiFallbackRate = counters.ai.request_count > 0
    ? clampRate(counters.ai.fallback_count / counters.ai.request_count)
    : 0;

  return {
    api_request_count: apiRequestCount,
    api_error_count: counters.api_error_count,
    request_count: requestCount,
    avg_latency: buildAverage(counters.total_latency, requestCount),
    p95_latency: p95Latency,
    p99_latency: p99Latency,
    avg_pipeline_ms: buildAverage(counters.total_pipeline_time, requestCount),
    avg_optimizer_ms: buildAverage(counters.total_optimizer_time, requestCount),
    avg_candidate_count: buildAverage(counters.total_candidate_count, requestCount),
    fallback_rate: fallbackRate,
    engine_health: {
      p0_violation_plans_total: counters.engine.p0_violation_plans_total,
      avg_relaxation_level: buildAverage(counters.engine.relaxation_level_sum, counters.engine.relaxation_samples),
      relaxation_samples: counters.engine.relaxation_samples,
      p0_trace_flag_rate: requestCount > 0
        ? clampRate(counters.engine.p0_violation_plans_total / requestCount)
        : 0,
    },
    totals: {
      pipeline_ms: Number(counters.total_pipeline_time.toFixed(3)),
      optimizer_ms: Number(counters.total_optimizer_time.toFixed(3)),
      candidate_count: counters.total_candidate_count,
      fallback_count: counters.ai_fallback_count,
    },
    last_request: { ...counters.last_request },
    confidence_distribution: { ...counters.confidence_distribution },
    errors: { ...counters.errors },
    ai_metrics: {
      request_count: counters.ai.request_count,
      response_count: counters.ai.response_count,
      schema_valid_count: counters.ai.schema_valid_count,
      schema_invalid_count: counters.ai.schema_invalid_count,
      fallback_count: counters.ai.fallback_count,
      avg_latency_ms: buildAverage(counters.ai.total_latency, counters.ai.response_count),
      schema_compliance_rate: aiValidations > 0 ? clampRate(counters.ai.schema_valid_count / aiValidations) : 0,
      invalid_response_rate: aiValidations > 0 ? clampRate(counters.ai.schema_invalid_count / aiValidations) : 0,
      fallback_rate: aiFallbackRate,
      latency_histogram: { ...counters.ai.latency_histogram },
    },
    ai_disagreement: {
      compared_count: counters.ai_disagreement.compared_count,
      mismatch_count: counters.ai_disagreement.mismatch_count,
      mismatch_rate: counters.ai_disagreement.compared_count > 0
        ? Number((counters.ai_disagreement.mismatch_count / counters.ai_disagreement.compared_count).toFixed(6))
        : 0,
    },
    optimizer_search: {
      beam_layer_expansions_total: counters.optimizer_search.beam_layer_expansions_total,
      beam_prune_events_total: counters.optimizer_search.beam_prune_events_total,
    },
  };
}

function getDashboardTelemetry({ user_id, trend_limit = 5 } = {}) {
  const safeLimit = Math.max(1, Math.trunc(toSafeNumber(trend_limit, 5)));
  const snapshot = getSnapshot();

  return {
    generated_at: Date.now(),
    fallback_rate: snapshot.fallback_rate,
    score_trend: getRecentTrend(counters.trends.score, safeLimit),
    confidence_trend: getRecentTrend(counters.trends.confidence, safeLimit),
    fallback_rate_trend: getRecentTrend(counters.trends.fallback_rate, safeLimit),
    adherence_history: getRecentAdherence(user_id, 10),
  };
}

function resetMetrics() {
  counters.api_request_count = 0;
  counters.api_error_count = 0;
  counters.request_count = 0;
  counters.total_latency = 0;
  counters.total_pipeline_time = 0;
  counters.total_optimizer_time = 0;
  counters.total_candidate_count = 0;
  counters.ai_fallback_count = 0;
  counters.confidence_distribution = {
    low: 0,
    medium: 0,
    high: 0,
  };
  counters.errors = {
    SCHEMA_VALIDATION_FAILED: 0,
    OPTIMIZER_FAILURE: 0,
    AI_FAILURE: 0,
    CACHE_ERROR: 0,
    CACHE_PARSE_ERROR: 0,
    SYSTEM_ERROR: 0,
  };
  counters.last_request = {
    latency_ms: 0,
    pipeline_ms: 0,
    optimizer_ms: 0,
    candidate_count: 0,
    used_fallback: false,
    confidence_level: "low",
    p0_violations: 0,
    relaxation_level: 0,
    fallback_reason: "",
  };
  counters.engine = {
    p0_violation_plans_total: 0,
    relaxation_level_sum: 0,
    relaxation_samples: 0,
  };
  counters.optimizer_search = {
    beam_layer_expansions_total: 0,
    beam_prune_events_total: 0,
  };
  counters.latency_samples = [];
  counters.ai = {
    request_count: 0,
    response_count: 0,
    total_latency: 0,
    fallback_count: 0,
    schema_valid_count: 0,
    schema_invalid_count: 0,
    latency_histogram: {
      le_50ms: 0,
      le_100ms: 0,
      le_250ms: 0,
      le_500ms: 0,
      le_1000ms: 0,
      gt_1000ms: 0,
    },
  };
  counters.ai_disagreement = {
    compared_count: 0,
    mismatch_count: 0,
  };
  counters.trends = {
    score: [],
    confidence: [],
    fallback_rate: [],
  };
  counters.adherence_events = [];
}

module.exports = {
  recordApiRequest,
  recordApiError,
  recordRequest,
  recordError,
  recordAIRequest,
  recordAIResponse,
  recordAIValidation,
  recordAIFallback,
  recordOptimizerSearch,
  recordAIDisagreement,
  recordAdherenceEvent,
  percentile,
  getSnapshot,
  getDashboardTelemetry,
  resetMetrics,
};
