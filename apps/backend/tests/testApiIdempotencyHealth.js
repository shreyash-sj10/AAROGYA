const { registerPlanRoutes } = require("../src/api/plan.routes");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function executeHandlers(handlers, req, res) {
  let index = 0;

  async function runNext(error) {
    if (error) {
      throw error;
    }

    const handler = handlers[index];
    index += 1;

    if (!handler) {
      return;
    }

    if (handler.length >= 3) {
      return handler(req, res, runNext);
    }

    const maybePromise = handler(req, res, runNext);
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
  }

  await runNext();
}

function buildRequest() {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: "idem_req_1",
    trace_id: "idem_trace_1",
    user_state: {
      user_id: "idem_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: {
        meal_type: "lunch",
        season: "summer",
      },
    },
    constraints: {
      max_calories: 600,
      diet_type: "vegetarian",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "idempotency_test",
      cache_allowed: false,
    },
  };
}

function canonicalize(body) {
  const outer = JSON.parse(JSON.stringify(body || {}));
  const safe = outer.data && typeof outer.data === "object" ? outer.data : outer;
  if (safe && safe.meta) {
    safe.meta.cache_hit = false;
    safe.meta.served_latency_ms = 0;
  }
  return safe;
}

(async () => {
  const routes = {};
  const app = {
    post(path, ...handlers) {
      routes[path] = handlers;
    },
    get(path, ...handlers) {
      routes[path] = handlers;
    },
  };

  let generateCount = 0;
  const redisStub = {
    store: new Map(),
    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    async set(key, value) {
      this.store.set(key, value);
      return true;
    },
    async delete(key) {
      this.store.delete(key);
      return 1;
    },
    async del(key) {
      return this.delete(key);
    },
    async healthCheck() {
      return true;
    },
  };

  registerPlanRoutes(app, {
    generatePlan: async () => {
      generateCount += 1;
      return {
        version: "DecisionResponse_v1",
        schema_version: 1,
        compatibility: "backward",
        request_id: "idem_req_1",
        trace_id: "idem_trace_1",
        meal_plan: [{ recipe_id: "meal_a", name: "A", quantity: { value: 100, unit: "grams" } }],
        nutrition_summary: { calories: 400, protein: 20, carbs: 45, fat: 12 },
        score: 0.7,
        confidence: {
          version: "Confidence_v1",
          schema_version: 1,
          compatibility: "backward",
          value: 0.7,
          level: "medium",
          components: { penalty_impact: 1, diversity_impact: 1, relaxation_impact: 1 },
        },
        trace: {
          version: "Trace_v1",
          schema_version: 1,
          compatibility: "backward",
          trace_id: "idem_trace_1",
          timestamp: 1711929600,
          stages: {
            interpretation_layer: { ml_used: false, ml_confidence: 0, ml_contribution_weight: 0 },
            candidate_generator: { input_count: 0, output_count: 1 },
            constraint_engine: { input_count: 1, output_count: 1, rejected: 0, rules: [], p0_rules_checked: 0, p0_violations: 0, p0_violated_rule_ids: [] },
            scoring_engine: { input_count: 1, output_count: 1 },
            diversity_engine: { input_count: 1, output_count: 1 },
            optimizer: { input_count: 1, output_count: 1, combinations_evaluated: 1, selected_score: 0.7 },
            reliability_engine: { input_count: 1, output_count: 1 },
          },
        },
        explanation: { deterministic: "ok", ai_explanation: "", citations: [] },
        insights: [],
        warnings: [],
        meta: {
          latency_ms: 1,
          cache_hit: false,
          model_version: "assistive_offline_v1",
          prompt_version: "prompt_v1",
          rules_version: "rules_v1",
        },
      };
    },
    redisClient: redisStub,
    dbService: { async healthCheck() { return true; } },
    getAIHealth: async () => true,
  });

  const reqA = { body: buildRequest() };
  const resA = createMockRes();
  await executeHandlers(routes["/plan"], reqA, resA);

  const reqB = { body: buildRequest() };
  const resB = createMockRes();
  await executeHandlers(routes["/plan"], reqB, resB);

  assert(resA.statusCode === 200 && resB.statusCode === 200, "idempotent plan responses must return 200");
  assert(generateCount === 1, "duplicate request should execute generator exactly once");
  const resBData = resB.body && resB.body.data ? resB.body.data : resB.body;
  assert(resBData && resBData.meta && resBData.meta.cache_hit === true, "cache hit response must set meta.cache_hit=true");
  assert(JSON.stringify(canonicalize(resA.body && resA.body.data ? resA.body.data : resA.body)) === JSON.stringify(canonicalize(resBData)), "cached response should remain contract-equivalent");

  const healthRes = createMockRes();
  await executeHandlers(routes["/health"], { body: {} }, healthRes);
  assert(healthRes.statusCode === 200, "healthy dependencies should return health 200");
  assert(healthRes.body && healthRes.body.status === "ok", "health payload should report ok");
  assert(typeof healthRes.body.request_id === "string" && typeof healthRes.body.trace_id === "string", "health must include top-level identity");
  assert(healthRes.body && healthRes.body.trace && healthRes.body.trace.version === "Trace_v1", "health must include Trace_v1");

  const metricsRes = createMockRes();
  await executeHandlers(routes["/metrics"], { body: {} }, metricsRes);
  assert(metricsRes.statusCode === 200, "metrics endpoint should return 200");
  assert(metricsRes.body && metricsRes.body.version === "MetricsResponse_v1", "metrics must return normalized contract");
  assert(typeof metricsRes.body.request_id === "string" && typeof metricsRes.body.trace_id === "string", "metrics must include top-level identity");
  assert(metricsRes.body && metricsRes.body.trace && metricsRes.body.trace.version === "Trace_v1", "metrics must include Trace_v1");

  console.log("PASS: idempotency caching works and ops trace policy is enforced");
})();



