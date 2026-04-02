const { registerWeeklyRoutes, buildWeeklyIdempotencyKey } = require("../src/api/routes/weekly.routes");

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

function buildWeeklyRequest() {
  return {
    version: "WeeklyDecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    user_id: "weekly_test_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: ["bloating"],
    dosha_profile: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: ["warm_food"],
    week_context: {
      days: 3,
      start_date: "2026-01-01",
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
      season: "summer",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "weekly_api_test",
      cache_allowed: true,
      request_id: "weekly_req_1",
      trace_id: "weekly_trace_1",
    },
  };
}

function canonicalize(body) {
  const safe = JSON.parse(JSON.stringify(body || {}));
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
  };

  const redisStub = {
    store: new Map(),
    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    async set(key, value) {
      this.store.set(key, value);
      return true;
    },
    async del(key) {
      this.store.delete(key);
      return 1;
    },
  };

  registerWeeklyRoutes(app, { redisClient: redisStub });

  assert(Array.isArray(routes["/weekly-plan"]) && routes["/weekly-plan"].length === 1, "Route /weekly-plan must register handler");

  const reqA = { body: buildWeeklyRequest() };
  const resA = createMockRes();
  await executeHandlers(routes["/weekly-plan"], reqA, resA);

  assert(resA.statusCode === 200, "Expected valid weekly request to return 200");
  assert(resA.body && resA.body.version === "WeeklyDecisionResponse_v1", "Expected WeeklyDecisionResponse_v1");
  assert(typeof resA.body.request_id === "string" && typeof resA.body.trace_id === "string", "Expected top-level identity");
  assert(resA.body.trace && resA.body.trace.version === "Trace_v1", "Expected Trace_v1 trace");
  assert(Array.isArray(resA.body.weekly_plan) && resA.body.weekly_plan.length === 3, "Expected 3-day weekly_plan");
  assert(resA.body.meta && resA.body.meta.cache_hit === false, "Expected first response cache_hit=false");

  const reqB = { body: buildWeeklyRequest() };
  const resB = createMockRes();
  await executeHandlers(routes["/weekly-plan"], reqB, resB);

  assert(resB.statusCode === 200, "Expected cached weekly request to return 200");
  assert(resB.body && resB.body.meta && resB.body.meta.cache_hit === true, "Expected second response cache_hit=true");

  const cacheKey = buildWeeklyIdempotencyKey(reqA.body);
  assert(redisStub.store.has(cacheKey), "Expected idempotency cache entry to exist");

  const reqC = { body: buildWeeklyRequest() };
  const resC = createMockRes();
  await executeHandlers(routes["/weekly-plan"], reqC, resC);

  assert(resC.statusCode === 200, "Expected deterministic repeated response to return 200");
  assert(
    JSON.stringify(canonicalize(resB.body)) === JSON.stringify(canonicalize(resC.body)),
    "Expected deterministic weekly output across repeated identical requests"
  );

  console.log("PASS: weekly API request succeeds, internal dependency ownership works, deterministic output is stable, and idempotent cache hit works");
})();
