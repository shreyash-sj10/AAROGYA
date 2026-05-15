const crypto = require("crypto");
const { validateRequest } = require("./middleware/validateRequest");
const { adaptDecisionRequest } = require("./adapters/decisionRequest.adapter");
const { generateMealPlan } = require("../core/pipeline/orchestrator");
const { generateDailyPlan } = require("../services/dailyPlan.service");
const { generateWeeklyPlan } = require("../modules/planner/weeklyPlanner.service");
const { validateDailyResponse } = require("../contracts/validators/validateDailyResponse");
const { validatePlanWeeklyRequest } = require("../contracts/validators/validatePlanWeeklyRequest");
const { validatePlanWeeklyResponse } = require("../contracts/validators/validatePlanWeeklyResponse");
const { validateHealthResponse } = require("../contracts/validators/validateHealthResponse");
const { validateMetricsResponse } = require("../contracts/validators/validateMetricsResponse");
const { buildErrorResponse } = require("../contracts/errorBuilder");
const redis = require("../services/cache/redis.service");
const pg = require("../services/db/pg.service");
const { getRecentMeals } = require("../repositories/history.repository");
const { getDecisionLog, getRecentLogs } = require("../repositories/decisionLog.repository");
const { listRecentAdherence } = require("../repositories/adherence.repository");
const { getSnapshot, getDashboardTelemetry, recordError } = require("../observability/metrics");
const { formatPrometheusText } = require("../observability/prometheusText");
const { computeSystemOk, enrichHealthChecks, envEnabled } = require("./health");

const IDEMPOTENCY_TTL_SECONDS = Number(process.env.AAROGYA_IDEMPOTENCY_TTL_SECONDS || 300);

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


function buildDailyIdempotencyKey(payload) {
  const hash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `idempotency:plan:daily:${hash}`;
}
function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}


function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalizeDecisionResponseForHash(response) {
  const payload = clone(toSafeObject(response));
  payload.meta = {
    ...toSafeObject(payload.meta),
    latency_ms: 0,
    served_latency_ms: 0,
  };
  return payload;
}

function sha256Of(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
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

function isValidCachedResponse(parsed) {
  try {
    ensurePlanResultShape(unwrapPlanResult(parsed));
    return true;
  } catch (_error) {
    return false;
  }
}



function isValidCachedDailyResponse(parsed) {
  const dailyValidation = validateDailyResponse(parsed);
  return Boolean(dailyValidation && dailyValidation.valid);
}
function mapErrorToStatus(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("Missing required field") || message.startsWith("Invalid dosha_estimate")) {
    return { status: 400, code: "VALIDATION_ERROR", message };
  }
  if (message.startsWith("DB failure:")) {
    return { status: 503, code: "DB_UNAVAILABLE", message };
  }
  if (message === "No valid plan under constraints") {
    return { status: 422, code: "NO_VALID_PLAN", message: "No valid plan under constraints" };
  }
  if (message.startsWith("AI Boundary Error:")) {
    return { status: 503, code: "AI_UNAVAILABLE", message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

function applyCacheDegradedMeta(response, cacheError) {
  const payload = clone(response);
  payload.meta = { ...toSafeObject(payload.meta), cache_hit: false };
  if (cacheError) payload.meta.cache_error = true;
  return payload;
}

function unwrapPlanResult(payload) {
  const safe = toSafeObject(payload);
  const envelopeData = toSafeObject(safe.data);
  if (safe.success === true && Object.keys(envelopeData).length > 0) {
    return envelopeData;
  }
  return safe;
}

function ensurePlanResultShape(result) {
  const safe = toSafeObject(result);
  const mealPlan = toSafeArray(safe.meal_plan);

  if (mealPlan.length === 0) {
    throw new Error("Invalid pipeline result: meal_plan is empty");
  }

  const safeConfidence = toSafeObject(safe.confidence);
  const confidenceValue = Number.isFinite(Number(safeConfidence.value))
    ? Number(safeConfidence.value)
    : 0.8;

  return {
    ...safe,
    meal_plan: mealPlan,
    trace: toSafeObject(safe.trace),
    confidence: Object.keys(safeConfidence).length > 0
      ? safeConfidence
      : { value: confidenceValue },
    score: Number.isFinite(Number(safe.score)) ? Number(safe.score) : 0,
    explanation: safe.explanation !== undefined ? safe.explanation : "",
  };
}

function buildPlanSuccessResponse(result) {
  const shaped = ensurePlanResultShape(result);
  return {
    success: true,
    data: shaped,
  };
}
function buildOperationalTrace(traceId, startedAt, outputCount = 1, selectedScore = 1) {
  const out = Math.max(0, Math.trunc(outputCount));
  const score = Math.max(0, Math.min(1, Number(selectedScore) || 0));
  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: toSafeString(traceId, "ops_trace"),
    timestamp: Math.max(0, Math.floor(startedAt)),
    stages: {
      interpretation_layer: { ml_used: false, ml_confidence: 0, ml_contribution_weight: 0 },
      candidate_generator: { input_count: 1, output_count: out },
      constraint_engine: {
        input_count: 1,
        output_count: out,
        rejected: 0,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      },
      scoring_engine: { input_count: 1, output_count: out },
      diversity_engine: { input_count: 1, output_count: out },
      optimizer: {
        input_count: 1,
        output_count: out,
        combinations_evaluated: 1,
        selected_score: score,
      },
      reliability_engine: { input_count: 1, output_count: out },
    },
  };
}

function logPlanRequest(routePath, body) {
  const safeBody = toSafeObject(body);
  const safeMeta = toSafeObject(safeBody.meta);
  const safeContext = toSafeObject(toSafeObject(safeBody.user_state).context);
  const safeConstraints = toSafeObject(safeBody.constraints);

  console.info(JSON.stringify({
    event: "plan_request_received",
    route: routePath,
    request_id: toSafeString(safeBody.request_id || safeMeta.request_id, "unknown_request"),
    trace_id: toSafeString(safeBody.trace_id || safeMeta.trace_id, "unknown_trace"),
    has_body: Object.keys(safeBody).length > 0,
    meal_type: toSafeString(safeContext.meal_type, "unknown"),
    season: toSafeString(safeContext.season, "unknown"),
    max_calories: Number.isFinite(Number(safeConstraints.max_calories)) ? Number(safeConstraints.max_calories) : null,
    diet_type: toSafeString(safeConstraints.diet_type, "unknown"),
    timestamp: Date.now(),
  }));
}
function createDefaultMetricsSnapshot() {
  return {
    api_request_count: 0, api_error_count: 0, request_count: 0, avg_latency: 0, p95_latency: 0, p99_latency: 0,
    avg_pipeline_ms: 0, avg_optimizer_ms: 0, avg_candidate_count: 0, fallback_rate: 0,
    engine_health: {
      p0_violation_plans_total: 0,
      avg_relaxation_level: 0,
      relaxation_samples: 0,
      p0_trace_flag_rate: 0,
    },
    totals: { pipeline_ms: 0, optimizer_ms: 0, candidate_count: 0, fallback_count: 0 },
    last_request: {
      latency_ms: 0, pipeline_ms: 0, optimizer_ms: 0, candidate_count: 0, used_fallback: false, confidence_level: "low",
      p0_violations: 0, relaxation_level: 0, fallback_reason: "",
    },
    confidence_distribution: { low: 0, medium: 0, high: 0 },
    errors: { SCHEMA_VALIDATION_FAILED: 0, OPTIMIZER_FAILURE: 0, AI_FAILURE: 0, CACHE_ERROR: 0, CACHE_PARSE_ERROR: 0, SYSTEM_ERROR: 0 },
    ai_metrics: { request_count: 0, response_count: 0, schema_valid_count: 0, schema_invalid_count: 0, fallback_count: 0, avg_latency_ms: 0, schema_compliance_rate: 0, invalid_response_rate: 0, fallback_rate: 0, latency_histogram: { le_50ms: 0, le_100ms: 0, le_250ms: 0, le_500ms: 0, le_1000ms: 0, gt_1000ms: 0 } },
    ai_disagreement: { compared_count: 0, mismatch_count: 0, mismatch_rate: 0 },
  };
}

function buildMetricsResponse(identity, snapshot, startedAt) {
  return {
    version: "MetricsResponse_v1",
    request_id: identity.request_id,
    trace_id: identity.trace_id,
    trace: buildOperationalTrace(identity.trace_id, startedAt, 1, 1),
    ...snapshot,
    meta: { latency_ms: Math.max(0, Date.now() - startedAt), request_id: identity.request_id, trace_id: identity.trace_id },
  };
}

function buildTelemetryFallbackResponse(user_id, trendLimit, reason = "telemetry_unavailable") {
  const safeUserId = toSafeString(user_id, "anonymous");
  const safeTrendLimit = Math.min(20, Math.max(3, Number(trendLimit) || 5));
  const emptyTrend = Array.from({ length: safeTrendLimit }, (_, index) => ({
    timestamp: Date.now() - ((safeTrendLimit - index) * 60000),
    value: 0,
  }));

  return {
    user_id: safeUserId,
    generated_at: Date.now(),
    fallback_rate: 0,
    score_trend: emptyTrend,
    confidence_trend: emptyTrend,
    fallback_rate_trend: emptyTrend,
    adherence_history: [],
    meta: {
      degraded: true,
      reason: toSafeString(reason, "telemetry_unavailable"),
    },
  };
}


function registerPlanRoutes(app, deps = {}) {
  if (!app || typeof app.post !== "function" || typeof app.get !== "function") {
    throw new Error("registerPlanRoutes requires an app with post/get handlers");
  }

  const generatePlan = typeof deps.generatePlan === "function" ? deps.generatePlan : generateMealPlan;
  const generateDaily = typeof deps.generateDailyPlan === "function" ? deps.generateDailyPlan : generateDailyPlan;
  const generateWeekly = typeof deps.generateWeeklyPlan === "function" ? deps.generateWeeklyPlan : generateWeeklyPlan;
  const adaptRequest = typeof deps.adaptDecisionRequest === "function" ? deps.adaptDecisionRequest : adaptDecisionRequest;
  const redisClient = deps.redisClient && typeof deps.redisClient === "object" ? deps.redisClient : redis;
  const dbService = deps.dbService && typeof deps.dbService === "object" ? deps.dbService : pg;
  const getAIHealth = typeof deps.getAIHealth === "function" ? deps.getAIHealth : (async () => ({ healthy: true, source: "deterministic" }));

  app.post("/plan", validateRequest, async (req, res) => {
  const startedAt = Date.now();
  console.info("[Plan] req.body:", JSON.stringify(req.body));
  logPlanRequest("/plan", req.body);
  const idempotencyKey = buildIdempotencyKey(req.body);
  let cacheError = false;

  try {
    let cached = null;
    try {
      cached = await redisClient.get(idempotencyKey);
    } catch (_e) {
      cacheError = true;
      recordError("CACHE_ERROR");
    }

    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedResult = unwrapPlanResult(parsed);
      if (isValidCachedResponse(cachedResult)) {
        const payload = clone(cachedResult);
        payload.meta = { ...toSafeObject(payload.meta), cache_hit: true, served_latency_ms: Date.now() - startedAt };
        const responsePayload = buildPlanSuccessResponse(payload);
        console.info("[Plan] response payload:", JSON.stringify(responsePayload));
        return res.status(200).json(responsePayload);
      }
    }

    const input = adaptRequest(req.body);
    const result = await generatePlan(input);
    console.info("[Plan] final pipeline result:", JSON.stringify(result));
    const payload = ensurePlanResultShape(applyCacheDegradedMeta(result, cacheError));

    try {
      await redisClient.set(idempotencyKey, JSON.stringify(payload), 300);
    } catch (_e) {
      recordError("CACHE_ERROR");
    }

    const responsePayload = buildPlanSuccessResponse(payload);
    console.info("[Plan] response payload:", JSON.stringify(responsePayload));
    return res.status(200).json(responsePayload);
  } catch (error) {
    const mapped = mapErrorToStatus(error);
    return res.status(mapped.status).json(buildApiError(mapped.code, mapped.message, req.body));
  }
});


  app.post("/plan/daily", validateRequest, async (req, res) => {
    logPlanRequest("/plan/daily", req.body);
    const idempotencyKey = buildDailyIdempotencyKey(req.body);
    let cacheError = false;

    try {
      let cached = null;
      try { cached = await redisClient.get(idempotencyKey); } catch (_e) { cacheError = true; recordError("CACHE_ERROR"); }

      if (cached) {
        const parsed = JSON.parse(cached);
        if (isValidCachedDailyResponse(parsed)) {
          return res.status(200).json(parsed);
        }
      }

      const input = adaptRequest(req.body);
      const result = await generateDaily(input, { runPlan: generatePlan });

      const dailyValidation = validateDailyResponse(result);
      if (!dailyValidation.valid) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "DailyResponse_v1 validation failed", req.body, {
          source: "api.plan.daily",
          errors: dailyValidation.errors || [],
        }));
      }

      try {
        await redisClient.set(
          idempotencyKey,
          JSON.stringify(result),
          Number.isFinite(IDEMPOTENCY_TTL_SECONDS) && IDEMPOTENCY_TTL_SECONDS > 0 ? IDEMPOTENCY_TTL_SECONDS : 300
        );
      } catch (_e) {
        cacheError = true;
        recordError("CACHE_ERROR");
      }

      if (cacheError) {
        return res.status(200).json({
          ...result,
          meta: {
            ...toSafeObject(result.meta),
            cache_error: true,
          },
        });
      }

      return res.status(200).json(result);
    } catch (error) {
      const mapped = mapErrorToStatus(error);
      return res.status(mapped.status).json(buildApiError(mapped.code, mapped.message, req.body));
    }
  });

  app.post("/plan/weekly", async (req, res) => {
    try {
      const requestValidation = validatePlanWeeklyRequest(req.body);
      if (!requestValidation.valid) {
        return res.status(400).json(buildApiError("VALIDATION_ERROR", "PlanWeeklyRequest_v1 validation failed", req.body, {
          source: "api.plan.weekly",
          errors: requestValidation.errors || [],
        }));
      }

      const result = await generateWeekly(req.body);
      const responseValidation = validatePlanWeeklyResponse(result);

      if (!responseValidation.valid) {
        return res.status(500).json(buildApiError("RESPONSE_VALIDATION_ERROR", "PlanWeeklyResponse_v1 validation failed", req.body, {
          source: "api.plan.weekly",
          errors: responseValidation.errors || [],
        }));
      }

      return res.status(200).json(result);
    } catch (error) {
      const mapped = mapErrorToStatus(error);
      return res.status(mapped.status).json(buildApiError(mapped.code, mapped.message, req.body, {
        source: "api.plan.weekly",
      }));
    }
  });

  /**
   * Phase 2: Replay Endpoint
   */
  app.post("/plan/replay", async (req, res) => {
    const { request_id } = toSafeObject(req.body);
    if (!request_id) return res.status(400).json(buildApiError("VALIDATION_ERROR", "Missing request_id", req.body));
    try {
      const log = await getDecisionLog(request_id);
      if (!log) return res.status(404).json(buildApiError("NOT_FOUND", "Log not found", req.body));
      const originalRequest = toSafeObject(log.request_payload);
      const originalResponse = toSafeObject(log.response_payload);
      const input = adaptRequest(originalRequest);
      const newResult = await generatePlan(input);
      const originalRecipes = toSafeObject(originalResponse).meal_plan?.map(m => m.recipe_id).join(",") || "";
      const newRecipes = newResult.meal_plan?.map(m => m.recipe_id).join(",") || "";
      const isIdentical = originalRecipes === newRecipes;
      return res.status(200).json({ request_id, is_identical: isIdentical, original_response: originalResponse, new_response: newResult });
    } catch (error) {
      return res.status(500).json(buildApiError("REPLAY_FAILED", error.message, req.body));
    }
  });

  /**
   * Phase 2: Determinism Check
   */
  app.post("/plan/test-determinism", async (req, res) => {
    const input = adaptRequest(req.body);
    const iterations = Math.min(10, Math.max(2, Number(req.query.n) || 5));
    const runs = [];
    try {
      for (let i = 0; i < iterations; i++) {
        const result = await generatePlan(input);
        const canonical = canonicalizeDecisionResponseForHash(result);
        const mealSignature = toSafeObject(result).meal_plan?.map((m) => m.recipe_id).join(",") || "";
        runs.push({
          run: i + 1,
          meal_signature: mealSignature,
          output_hash: sha256Of(canonical),
          trace_hash: sha256Of(toSafeObject(result).trace),
        });
      }

      const baseline = runs[0];
      const identicalOutputs = runs.every((r) => r.output_hash === baseline.output_hash);
      const identicalTraces = runs.every((r) => r.trace_hash === baseline.trace_hash);
      const firstMismatch = runs.find((r) => r.output_hash !== baseline.output_hash || r.trace_hash !== baseline.trace_hash) || null;

      return res.status(200).json({
        iterations,
        identical_outputs: identicalOutputs,
        identical_traces: identicalTraces,
        first_mismatch_run: firstMismatch ? firstMismatch.run : null,
        runs,
      });
    } catch (error) {
      return res.status(500).json(buildApiError("DETERMINISM_FAILED", error.message, req.body));
    }
  });

  app.get("/dashboard/telemetry", async (req, res) => {
    const safeQuery = toSafeObject(req.query);
    const user_id = toSafeString(safeQuery.user_id, "anonymous");
    const trendLimit = Math.min(20, Math.max(3, Number(safeQuery.trend_limit) || 5));

    let telemetry = buildTelemetryFallbackResponse(user_id, trendLimit, "telemetry_default");
    try {
      telemetry = {
        ...telemetry,
        ...toSafeObject(getDashboardTelemetry({ user_id, trend_limit: trendLimit })),
      };
    } catch (error) {
      console.error(`[DashboardTelemetry] metrics failed: ${error instanceof Error ? error.message : "unknown_error"}`);
    }

    try {
      telemetry.adherence_history = await listRecentAdherence(user_id, 10);
    } catch (error) {
      telemetry.adherence_history = [];
      telemetry.meta = {
        ...toSafeObject(telemetry.meta),
        adherence_error: true,
        reason: "adherence_query_failed",
      };
      console.error(`[DashboardTelemetry] adherence failed: ${error instanceof Error ? error.message : "unknown_error"}`);
    }

    return res.status(200).json(telemetry);
  });

  app.get("/logs", async (req, res) => {
    const safeQuery = toSafeObject(req.query);
    const limit = Math.min(100, Math.max(1, Number(safeQuery.limit) || 20));

    try {
      const rows = await getRecentLogs(limit);
      const logs = rows.map((row) => ({
        timestamp: row.timestamp || new Date().toISOString(),
        action_type: "decision_logged",
        metadata: {
          request_id: row.request_id,
          trace_id: row.trace_id,
        },
      }));

      return res.status(200).json({ logs });
    } catch (error) {
      console.error(`[DashboardLogs] failed: ${error instanceof Error ? error.message : "unknown_error"}`);
      return res.status(500).json(buildApiError("LOGS_FAILED", error instanceof Error ? error.message : "Logs failed", {}));
    }
  });
  app.get("/metrics/prometheus", (_req, res) => {
    try {
      const snapshot = getSnapshot() || createDefaultMetricsSnapshot();
      res.type("text/plain; version=0.0.4; charset=utf-8");
      return res.status(200).send(formatPrometheusText(snapshot));
    } catch (error) {
      console.error(`[Prometheus] failed: ${error instanceof Error ? error.message : "unknown_error"}`);
      return res.status(500).type("text/plain").send("# metrics unavailable\n");
    }
  });

  app.get("/metrics", (_req, res) => {
    const startedAt = Date.now();
    const identity = createIdentity("metrics");
    try {
      const snapshot = getSnapshot() || createDefaultMetricsSnapshot();
      return res.status(200).json(buildMetricsResponse(identity, snapshot, startedAt));
    } catch (error) {
      console.error(`[DashboardMetrics] failed: ${error instanceof Error ? error.message : "unknown_error"}`);
      return res.status(500).json(buildApiError("METRICS_FAILED", error instanceof Error ? error.message : "Metrics failed", {}));
    }
  });

  app.get("/health", async (_req, res) => {
    const startedAt = Date.now();
    const identity = createIdentity("health");
    try {
      const health = { db: { ok: false }, redis: { ok: false }, ai: { ok: false } };

      let dbHealth;
      if (typeof dbService.getDatabaseHealth === "function") {
        dbHealth = await dbService.getDatabaseHealth();
      } else {
        const ok = await dbService.healthCheck();
        dbHealth = { ok: Boolean(ok), ...(!ok ? { error: "db_health_check_failed" } : {}) };
      }
      health.db = {
        ok: Boolean(dbHealth.ok),
        ...(dbHealth.error ? { error: String(dbHealth.error).slice(0, 500) } : {}),
      };

      if (envEnabled("USE_REDIS")) {
        try {
          const pingOk = await redisClient.healthCheck();
          const st = typeof redisClient.getHealthStatus === "function"
            ? redisClient.getHealthStatus()
            : {};
          health.redis = {
            ok: Boolean(pingOk),
            ...(!pingOk && st && st.error ? { error: String(st.error).slice(0, 500) } : {}),
          };
        } catch (err) {
          health.redis = {
            ok: false,
            error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
          };
        }
      } else {
        health.redis = { ok: true };
      }

      try {
        const aiResult = await getAIHealth();
        const aiOk = aiResult && typeof aiResult === "object"
          ? Boolean(aiResult.healthy === true || aiResult.ok === true)
          : Boolean(aiResult);
        health.ai = { ok: aiOk };
        if (!aiOk && aiResult && typeof aiResult === "object" && aiResult.error) {
          health.ai.error = String(aiResult.error).slice(0, 500);
        }
      } catch (err) {
        health.ai = {
          ok: false,
          error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        };
      }

      const enrichedHealth = enrichHealthChecks(health);
      const ok = computeSystemOk(enrichedHealth);
      const payload = {
        version: "HealthResponse_v1",
        request_id: identity.request_id,
        trace_id: identity.trace_id,
        trace: buildOperationalTrace(identity.trace_id, startedAt, 1, 1),
        status: ok ? "ok" : "degraded",
        checks: enrichedHealth,
        meta: { latency_ms: Math.max(0, Math.floor(Date.now() - startedAt)), request_id: identity.request_id, trace_id: identity.trace_id },
      };

      const hv = validateHealthResponse(payload);
      if (!hv.valid) {
        console.error("[Health] contract validation failed", hv.errors);
        return res.status(500).json(buildApiError("HEALTH_CONTRACT", "Health response validation failed", {}));
      }

      return res.status(ok ? 200 : 503).json(payload);
    } catch (error) {
      return res.status(500).json(buildApiError("HEALTH_FAILED", error instanceof Error ? error.message : String(error), {}));
    }
  });
}

module.exports = {
  registerPlanRoutes,
  buildIdempotencyKey,
};

































