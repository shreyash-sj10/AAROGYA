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

function buildValidRequestBody() {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: "api_req_1",
    trace_id: "api_trace_1",
    user_state: {
      user_id: "u1",
      goals: ["weight_loss"],
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
      request_source: "api_test",
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

  let orchestratorCallCount = 0;
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

  registerPlanRoutes(app, {
    generatePlan: async (payload) => {
      orchestratorCallCount += 1;
      return {
        ok: true,
        request_id: payload.request_id,
      };
    },
    redisClient: redisStub,
  });

  assert(Array.isArray(routes["/plan"]) && routes["/plan"].length === 2, "Route /plan must register middleware + handler");
  assert(Array.isArray(routes["/health"]) && routes["/health"].length === 1, "Route /health must register handler");

  const invalidReq = { body: {} };
  const invalidRes = createMockRes();
  await executeHandlers(routes["/plan"], invalidReq, invalidRes);

  assert(invalidRes.statusCode === 400, "Invalid payload must return HTTP 400");
  assert(invalidRes.body && invalidRes.body.version === "ErrorResponse_v1", "Invalid payload must return ErrorResponse_v1 envelope");
  assert(invalidRes.body && typeof invalidRes.body.request_id === "string", "Error payload must include top-level request_id");
  assert(invalidRes.body && invalidRes.body.trace && invalidRes.body.trace.version === "Trace_v1", "Error payload must include top-level Trace_v1");
  assert(invalidRes.body && invalidRes.body.error && invalidRes.body.error.code === "VALIDATION_ERROR", "Invalid payload must return validation code");
  assert(Array.isArray((invalidRes.body.error && invalidRes.body.error.details && invalidRes.body.error.details.errors) || []), "Invalid payload must include details.errors array");
  assert(orchestratorCallCount === 0, "Invalid payload must not reach orchestrator");

  const validReq = { body: buildValidRequestBody() };
  const validRes = createMockRes();
  await executeHandlers(routes["/plan"], validReq, validRes);

  assert(validRes.statusCode === 500, "Malformed fresh orchestrator output must be blocked with HTTP 500");
  assert(validRes.body && validRes.body.version === "ErrorResponse_v1", "Malformed fresh output must return ErrorResponse_v1");
  assert(validRes.body && validRes.body.error && validRes.body.error.code === "RESPONSE_VALIDATION_ERROR", "Malformed fresh output must return response validation error");
  assert(orchestratorCallCount === 1, "Valid request reaches orchestrator exactly once before boundary validation");

  console.log("PASS: API request validation enforces ErrorResponse_v1 and blocks malformed fresh /plan output");
})();
