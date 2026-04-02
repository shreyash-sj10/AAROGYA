const crypto = require("crypto");
const { adaptWeeklyDecisionRequest } = require("../adapters/weeklyRequest.adapter");
const { generateWeeklyPlan } = require("../../modules/planner/weeklyPlanner.service");
const { validateTrace } = require("../../contracts/validators/validateTrace");
const { validateWeeklyDecisionRequest } = require("../../contracts/validators/validateWeeklyDecisionRequest");
const { validateWeeklyDecisionResponse } = require("../../contracts/validators/validateWeeklyDecisionResponse");
const { buildErrorResponse } = require("../../contracts/errorBuilder");
const redis = require("../../services/cache/redis.service");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

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

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildWeeklyIdempotencyKey(payload) {
  const hash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `idempotency:weekly:${hash}`;
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
  const responseValidation = validateWeeklyDecisionResponse(parsed);
  const traceValidation = validateTrace(toSafeObject(parsed).trace);
  return Boolean(responseValidation.valid && traceValidation.valid);
}

function mapErrorToStatus(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.startsWith("Redis failure:")) {
    return { status: 503, code: "REDIS_UNAVAILABLE", message };
  }

  if (message.includes("validation failed")) {
    return { status: 400, code: "CONTRACT_VIOLATION", message };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

function buildApiError(code, message, reqBody, details = {}) {
  const safeDetails = details && typeof details === "object" ? details : {};
  const safeBody = reqBody && typeof reqBody === "object" ? reqBody : {};

  return buildErrorResponse({
    code,
    message,
    details: {
      request_id: toSafeString(toSafeBodyMeta(safeBody).request_id, "unknown_request"),
      trace_id: toSafeString(toSafeBodyMeta(safeBody).trace_id, "unknown_trace"),
      ...safeDetails,
    },
  });
}

function toSafeBodyMeta(body) {
  return toSafeObject(body.meta);
}

function registerWeeklyRoutes(app, deps = {}) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerWeeklyRoutes requires an app with post(path, ...handlers)");
  }

  const redisClient = deps.redisClient && typeof deps.redisClient === "object" ? deps.redisClient : redis;
  const adaptRequest = typeof deps.adaptWeeklyDecisionRequest === "function"
    ? deps.adaptWeeklyDecisionRequest
    : adaptWeeklyDecisionRequest;
  const generatePlan = typeof deps.generateWeeklyPlan === "function" ? deps.generateWeeklyPlan : generateWeeklyPlan;

  app.post("/weekly-plan", async (req, res) => {
    const start = Date.now();

    try {
      const requestValidation = validateWeeklyDecisionRequest(req && req.body);
      if (!requestValidation.valid) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "WeeklyDecisionRequest_v1 validation failed", req && req.body, {
          source: "api.weekly",
          errors: requestValidation.errors || [],
        }));
      }

      const idempotencyKey = buildWeeklyIdempotencyKey(req.body);
      const cached = await redisClient.get(idempotencyKey);

      if (cached) {
        let parsed = null;
        let validCache = false;

        try {
          parsed = JSON.parse(cached);
          validCache = isValidCachedResponse(parsed);
        } catch (error) {
          validCache = false;
          logError({
            request_id: toSafeString(toSafeBodyMeta(req.body).request_id, "weekly_request"),
            trace_id: toSafeString(toSafeBodyMeta(req.body).trace_id, "weekly_trace"),
            error_type: "SYSTEM_ERROR",
            message: `weekly cache parse failed: ${error instanceof Error ? error.message : "unknown"}`,
          });
          recordError("CACHE_PARSE_ERROR");
        }

        if (validCache) {
          const payload = clone(parsed);
          payload.meta = {
            ...toSafeObject(payload.meta),
            cache_hit: true,
            served_latency_ms: Math.max(0, Date.now() - start),
          };
          return res.status(200).json(payload);
        }

        await purgeCacheKey(redisClient, idempotencyKey);
      }

      const internalInput = adaptRequest(req.body);
      const result = await generatePlan(internalInput);

      result.request_id = toSafeString(result.request_id, toSafeString(internalInput.request_id, "weekly_request"));
      result.trace_id = toSafeString(result.trace_id, toSafeString(internalInput.trace_id, "weekly_trace"));
      result.trace = {
        ...toSafeObject(result.trace),
        trace_id: toSafeString(toSafeObject(result.trace).trace_id, result.trace_id),
      };
      result.meta = {
        ...toSafeObject(result.meta),
        latency_ms: Math.max(0, Date.now() - start),
        cache_hit: false,
        model_version: toSafeString(toSafeObject(result.meta).model_version, "assistive_offline_v1"),
        prompt_version: toSafeString(toSafeObject(result.meta).prompt_version, "prompt_v1"),
        rules_version: toSafeString(toSafeObject(result.meta).rules_version, "rules_v1"),
      };

      const traceValidation = validateTrace(result.trace);
      if (!traceValidation.valid) {
        return res.status(500).json(buildApiError("TRACE_VALIDATION_ERROR", "Trace_v1 validation failed", req && req.body, {
          source: "api.weekly",
          errors: traceValidation.errors || [],
        }));
      }

      const responseValidation = validateWeeklyDecisionResponse(result);
      if (!responseValidation.valid) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "WeeklyDecisionResponse_v1 validation failed", req && req.body, {
          source: "api.weekly",
          errors: responseValidation.errors || [],
        }));
      }

      await redisClient.set(
        idempotencyKey,
        JSON.stringify(result),
        Number.isFinite(IDEMPOTENCY_TTL_SECONDS) && IDEMPOTENCY_TTL_SECONDS > 0 ? IDEMPOTENCY_TTL_SECONDS : 300
      );

      return res.status(200).json(result);
    } catch (error) {
      const mapped = mapErrorToStatus(error);
      logError({
        request_id: toSafeString(toSafeBodyMeta(req && req.body).request_id, "weekly_request"),
        trace_id: toSafeString(toSafeBodyMeta(req && req.body).trace_id, "weekly_trace"),
        error_type: "SYSTEM_ERROR",
        message: mapped.message,
      });
      recordError("SYSTEM_ERROR");
      return res.status(mapped.status).json(buildApiError(mapped.code, mapped.message, req && req.body, {
        source: "api.weekly",
      }));
    }
  });
}

module.exports = {
  registerWeeklyRoutes,
  buildWeeklyIdempotencyKey,
};
