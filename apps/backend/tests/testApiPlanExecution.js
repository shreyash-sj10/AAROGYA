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

function buildDecisionRequest() {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: "api_exec_req_1",
    trace_id: "api_exec_trace_1",
    user_state: {
      user_id: "api_exec_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: ["warm_food"],
      context: {
        meal_type: "lunch",
        season: "summer",
      },
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "api_execution_test",
      cache_allowed: false,
    },
  };
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

  const redisStub = {
    store: new Map(),
    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    async set(key, value) {
      this.store.set(key, value);
      return true;
    },
    async healthCheck() {
      return true;
    },
  };

  registerPlanRoutes(app, { redisClient: redisStub });

  assert(Array.isArray(routes["/plan"]) && routes["/plan"].length === 2, "Route /plan must register middleware + handler");

  const req = { body: buildDecisionRequest() };
  const res = createMockRes();
  await executeHandlers(routes["/plan"], req, res);

  assert(res.statusCode === 200, "Expected /plan to execute end-to-end with 200");
  assert(res.body && typeof res.body === "object", "Expected response body");
  assert(res.body.version === "DecisionResponse_v1", "Expected DecisionResponse_v1 response");
  assert(res.body.trace && res.body.trace.version === "Trace_v1", "Expected Trace_v1 in response");
  assert(Array.isArray(res.body.meal_plan) && res.body.meal_plan.length > 0, "Expected non-empty meal_plan");

  console.log("PASS: DecisionRequest_v1 executes end-to-end through /plan via adapter mapping");
})();
