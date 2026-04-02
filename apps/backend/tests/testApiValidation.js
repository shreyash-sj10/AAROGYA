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
  assert(invalidRes.body && invalidRes.body.version === "v1", "Invalid payload must return versioned error envelope");
  assert(invalidRes.body && invalidRes.body.error && invalidRes.body.error.code === "VALIDATION_ERROR", "Invalid payload must return validation code");
  assert(Array.isArray((invalidRes.body.error && invalidRes.body.error.details && invalidRes.body.error.details.errors) || []), "Invalid payload must include details.errors array");
  assert(orchestratorCallCount === 0, "Invalid payload must not reach orchestrator");

  const validReq = { body: buildValidRequestBody() };
  const validRes = createMockRes();
  await executeHandlers(routes["/plan"], validReq, validRes);

  assert(validRes.statusCode === 200, "Valid payload must pass validation and return HTTP 200");
  assert(validRes.body && validRes.body.ok === true, "Valid payload must reach handler output");
  assert(orchestratorCallCount === 1, "Valid payload must reach orchestrator exactly once");

  console.log("PASS: API request validation enforces 400 on invalid and allows valid payloads");
})();
