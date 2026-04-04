const crypto = require("crypto");
const { validateRequest } = require("./middleware/validateRequest");
const { adaptDecisionRequest } = require("./adapters/decisionRequest.adapter");
const { generateMealPlan } = require("../core/pipeline/orchestrator");
const { validateDecisionResponse } = require("../contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../contracts/validators/validateTrace");
const { validateHealthResponse } = require("../contracts/validators/validateHealthResponse");
const { validateMetricsResponse } = require("../contracts/validators/validateMetricsResponse");
const { buildErrorResponse } = require("../contracts/errorBuilder");
const redis = require("../services/cache/redis.service");
const pg = require("../services/db/pg.service");
const { getHealthStatus } = require("../services/ml/mlClient");
const { getSnapshot, recordError } = require("../observability/metrics");

const IDEMPOTENCY_TTL_SECONDS = Number(process.env.AYUDIET_IDEMPOTENCY_TTL_SECONDS || 300);

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildIdempotencyKey(payload) {
  const hash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `idempotency:plan:${hash}`;
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIdentity(prefix) {
  const safePrefix = toSafeString(prefix, "api");
  const token = crypto.randomBytes(8).toString("hex");
  return {
    request_id: `${safePrefix}_request_${token}`,
    trace_id: `${safePrefix}_trace_${token}`,
  };
}

function buildApiError(code, message, reqBody, details = {}) {
  const safeDetails = details && typeof details === "object" ? details : {};
  const safeBody = reqBody && typeof reqBody === "object" ? reqBody : {};

  const metaRequestId = toSafeString(safeDetails.request_id || safeBody.request_id || toSafeObject(safeBody.meta).request_id, "unknown_request");
  const metaTraceId = toSafeString(safeDetails.trace_id || safeBody.trace_id || toSafeObject(safeBody.meta).trace_id, "unknown_trace");
  const { request_id: _rid, trace_id: _tid, ...detailWithoutMeta } = safeDetails;

  return buildErrorResponse({
    code,
    message,
    request_id: metaRequestId,
    trace_id: metaTraceId,
    details: detailWithoutMeta,
  });
}

async function purgeCacheKey(redisClient, key) {
  if (redisClient && typeof redisClient.delete === "function") {
    await redisClient.delete(key);
    return;
  }

  if (redisClient && typeof redisClient.del === "function") {
    await redisClient.del(key);
    return;
  }

  throw new Error("Redis failure: cache delete method is unavailable");
}

function isValidCachedResponse(parsed) {
  const decisionValidation = validateDecisionResponse(parsed);
  const traceValidation = validateTrace(parsed && parsed.trace);
  return Boolean(decisionValidation && decisionValidation.valid && traceValidation && traceValidation.valid);
}

function mapErrorToStatus(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.startsWith("DB failure:")) {
    return { status: 503, code: "DB_UNAVAILABLE", message };
  }

  if (message.startsWith("AI Boundary Error:")) {
    return { status: 503, code: "AI_UNAVAILABLE", message };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

function applyCacheDegradedMeta(response, cacheError) {
  const payload = clone(response);
  payload.meta = {
    ...toSafeObject(payload.meta),
    cache_hit: false,
  };

  if (cacheError) {
    payload.meta.cache_error = true;
  }

  return payload;
}

function buildOperationalTrace(traceId, startedAt, outputCount = 1, selectedScore = 1) {
  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: toSafeString(traceId, "ops_trace"),
    timestamp: Math.max(0, Math.floor(startedAt)),
    stages: {
      candidate_generator: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      constraint_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
        rejected: 0,
        rules: [],
      },
      scoring_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      diversity_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
      optimizer: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
        combinations_evaluated: 1,
        selected_score: Math.max(0, Math.min(1, selectedScore)),
      },
      reliability_engine: {
        input_count: 1,
        output_count: Math.max(0, outputCount),
      },
    },
  };
}
function createDefaultMetricsSnapshot() {
  return {
    api_request_count: 0,
    api_error_count: 0,
    request_count: 0,
    avg_latency: 0,
    p95_latency: 0,
    p99_latency: 0,
    avg_pipeline_ms: 0,
    avg_optimizer_ms: 0,
    avg_candidate_count: 0,
    fallback_rate: 0,
    totals: {
      pipeline_ms: 0,
      optimizer_ms: 0,
      candidate_count: 0,
      fallback_count: 0,
    },
    last_request: {
      latency_ms: 0,
      pipeline_ms: 0,
      optimizer_ms: 0,
      candidate_count: 0,
      used_fallback: false,
      confidence_level: "low",
    },
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
    ai_metrics: {
      request_count: 0,
      response_count: 0,
      schema_valid_count: 0,
      schema_invalid_count: 0,
      fallback_count: 0,
      avg_latency_ms: 0,
      schema_compliance_rate: 0,
      invalid_response_rate: 0,
      fallback_rate: 0,
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
      mismatch_rate: 0,
    },
  };
}

function buildMetricsResponse(identity, snapshot, startedAt) {
  return {
    version: "MetricsResponse_v1",
    request_id: identity.request_id,
    trace_id: identity.trace_id,
    trace: buildOperationalTrace(identity.trace_id, startedAt, 1, 1),
    ...snapshot,
    meta: {
      latency_ms: Math.max(0, Date.now() - startedAt),
      request_id: identity.request_id,
      trace_id: identity.trace_id,
    },
  };
}

function registerPlanRoutes(app, deps = {}) {
  if (!app || typeof app.post !== "function" || typeof app.get !== "function") {
    throw new Error("registerPlanRoutes requires an app with post(path, ...handlers) and get(path, ...handlers)");
  }

  const generatePlan = typeof deps.generatePlan === "function" ? deps.generatePlan : generateMealPlan;
  const adaptRequest = typeof deps.adaptDecisionRequest === "function"
    ? deps.adaptDecisionRequest
    : adaptDecisionRequest;
  const redisClient = deps.redisClient && typeof deps.redisClient === "object" ? deps.redisClient : redis;
  const dbService = deps.dbService && typeof deps.dbService === "object" ? deps.dbService : pg;
  const getAIHealth = typeof deps.getAIHealth === "function" ? deps.getAIHealth : getHealthStatus;

  app.post(
    "/plan",
    validateRequest,
    async (req, res) => {
      const startedAt = Date.now();
      const idempotencyKey = buildIdempotencyKey(req.body);
      let cacheError = false;

      try {
        let cached = null;
        try {
          cached = await redisClient.get(idempotencyKey);
        } catch (_error) {
          cacheError = true;
          recordError("CACHE_ERROR");
        }

        if (cached) {
          let parsed = null;
          let validCache = false;

          try {
            parsed = JSON.parse(cached);
            validCache = isValidCachedResponse(parsed);
          } catch (_error) {
            validCache = false;
            cacheError = true;
            recordError("CACHE_PARSE_ERROR");
          }

          if (validCache) {
            const payload = clone(parsed);
            payload.meta = {
              ...toSafeObject(payload.meta),
              cache_hit: true,
              served_latency_ms: Math.max(0, Date.now() - startedAt),
            };

            if (cacheError) {
              payload.meta.cache_error = true;
            }

            return res.status(200).json(payload);
          }

          try {
            await purgeCacheKey(redisClient, idempotencyKey);
          } catch (_error) {
            cacheError = true;
            recordError("CACHE_ERROR");
          }
        }

        const input = adaptRequest(req.body);
        const result = await generatePlan(input);
        const payload = applyCacheDegradedMeta(result, cacheError);

        const responseValidation = validateDecisionResponse(payload);
        if (!responseValidation.valid) {
          return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "DecisionResponse_v1 validation failed", req && req.body, {
            source: "api.plan",
            errors: responseValidation.errors || [],
          }));
        }

        const traceValidation = validateTrace(payload.trace);
        if (!traceValidation.valid) {
          return res.status(500).json(buildApiError("TRACE_VALIDATION_ERROR", "Trace_v1 validation failed", req && req.body, {
            source: "api.plan",
            errors: traceValidation.errors || [],
          }));
        }

        try {
          await redisClient.set(
            idempotencyKey,
            JSON.stringify(payload),
            Number.isFinite(IDEMPOTENCY_TTL_SECONDS) && IDEMPOTENCY_TTL_SECONDS > 0 ? IDEMPOTENCY_TTL_SECONDS : 300
          );
        } catch (_error) {
          payload.meta.cache_error = true;
          recordError("CACHE_ERROR");
        }

        return res.status(200).json(payload);
      } catch (error) {
        const mapped = mapErrorToStatus(error);
        return res.status(mapped.status).json(buildApiError(mapped.code, mapped.message, req && req.body, {
          source: "api.plan",
        }));
      }
    }
  );

  app.get(
    "/metrics",
    (_req, res) => {
      const startedAt = Date.now();
      const identity = createIdentity("metrics");

      let snapshot;
      try {
        snapshot = getSnapshot();
      } catch (_error) {
        snapshot = createDefaultMetricsSnapshot();
      }

      let response = buildMetricsResponse(identity, snapshot, startedAt);
      let validation = validateMetricsResponse(response);

      if (!validation.valid) {
        response = buildMetricsResponse(identity, createDefaultMetricsSnapshot(), startedAt);
        validation = validateMetricsResponse(response);
      }

      if (!validation.valid) {
        return res.status(200).json(buildMetricsResponse(identity, createDefaultMetricsSnapshot(), startedAt));
      }

      return res.status(200).json(response);
    }
  );

  app.get(
    "/health",
    async (_req, res) => {
      const startedAt = Date.now();
      const identity = createIdentity("health");

      try {
        const health = {
          db: { ok: false },
          redis: { ok: false },
          ai: { ok: false },
        };

        try {
          health.db.ok = await dbService.healthCheck();
        } catch (error) {
          health.db.error = error instanceof Error ? error.message : "db_check_failed";
        }

        try {
          health.redis.ok = await redisClient.healthCheck();
        } catch (error) {
          health.redis.error = error instanceof Error ? error.message : "redis_check_failed";
        }

        try {
          health.ai.ok = await getAIHealth();
        } catch (error) {
          health.ai.error = error instanceof Error ? error.message : "ai_check_failed";
        }

        const ok = Boolean(health.db.ok && health.redis.ok && health.ai.ok);

        const response = {
          version: "HealthResponse_v1",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          trace: buildOperationalTrace(identity.trace_id, startedAt, 1, ok ? 1 : 0),
          status: ok ? "ok" : "degraded",
          checks: health,
          meta: {
            latency_ms: Math.max(0, Date.now() - startedAt),
            request_id: identity.request_id,
            trace_id: identity.trace_id,
          },
        };

        const validation = validateHealthResponse(response);
        if (!validation.valid) {
          return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Health response validation failed", {}, {
            source: "api.health",
            errors: validation.errors || [],
            request_id: identity.request_id,
            trace_id: identity.trace_id,
          }));
        }

        return res.status(ok ? 200 : 503).json(response);
      } catch (error) {
        return res.status(500).json(buildApiError("HEALTH_CHECK_FAILED", "Failed to evaluate health", {}, {
          source: "api.health",
          reason: error instanceof Error ? error.message : "health_evaluation_failed",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
        }));
      }
    }
  );
}

module.exports = {
  registerPlanRoutes,
  buildIdempotencyKey,
};




