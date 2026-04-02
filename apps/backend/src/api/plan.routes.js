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
const { getSnapshot } = require("../observability/metrics");

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

  return buildErrorResponse({
    code,
    message,
    details: {
      request_id: toSafeString(safeBody.request_id || toSafeObject(safeBody.meta).request_id, "unknown_request"),
      trace_id: toSafeString(safeBody.trace_id || toSafeObject(safeBody.meta).trace_id, "unknown_trace"),
      ...safeDetails,
    },
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

  if (message.startsWith("Redis failure:")) {
    return { status: 503, code: "REDIS_UNAVAILABLE", message };
  }

  if (message.startsWith("DB failure:")) {
    return { status: 503, code: "DB_UNAVAILABLE", message };
  }

  if (message.startsWith("AI Boundary Error:")) {
    return { status: 503, code: "AI_UNAVAILABLE", message };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
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

      try {
        const idempotencyKey = buildIdempotencyKey(req.body);
        const cached = await redisClient.get(idempotencyKey);

        if (cached) {
          let parsed = null;
          let validCache = false;

          try {
            parsed = JSON.parse(cached);
            validCache = isValidCachedResponse(parsed);
          } catch (_error) {
            validCache = false;
          }

          if (validCache) {
            const payload = clone(parsed);
            payload.meta = {
              ...toSafeObject(payload.meta),
              cache_hit: true,
              served_latency_ms: Math.max(0, Date.now() - startedAt),
            };
            return res.status(200).json(payload);
          }

          await purgeCacheKey(redisClient, idempotencyKey);
        }

        const input = adaptRequest(req.body);
        const result = await generatePlan(input);

        await redisClient.set(
          idempotencyKey,
          JSON.stringify(result),
          Number.isFinite(IDEMPOTENCY_TTL_SECONDS) && IDEMPOTENCY_TTL_SECONDS > 0 ? IDEMPOTENCY_TTL_SECONDS : 300
        );

        return res.status(200).json(result);
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

      try {
        const snapshot = getSnapshot();
        const response = {
          version: "MetricsResponse_v1",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
          ...snapshot,
          meta: {
            latency_ms: Math.max(0, Date.now() - startedAt),
          },
        };

        const validation = validateMetricsResponse(response);
        if (!validation.valid) {
          return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "Metrics response validation failed", {}, {
            source: "api.metrics",
            errors: validation.errors || [],
            request_id: identity.request_id,
            trace_id: identity.trace_id,
          }));
        }

        return res.status(200).json(response);
      } catch (error) {
        return res.status(500).json(buildApiError("METRICS_UNAVAILABLE", "Failed to fetch metrics", {}, {
          source: "api.metrics",
          reason: error instanceof Error ? error.message : "metrics_fetch_failed",
          request_id: identity.request_id,
          trace_id: identity.trace_id,
        }));
      }
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
          status: ok ? "ok" : "degraded",
          checks: health,
          meta: {
            latency_ms: Math.max(0, Date.now() - startedAt),
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

