const { registerPlanRoutes } = require("../src/api/plan.routes");
const { generateMealPlan } = require("../src/core/pipeline/orchestrator");
const { validateDecisionResponse } = require("../src/contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../src/contracts/validators/validateTrace");

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
    request_id: "cache_contract_req_1",
    trace_id: "cache_contract_trace_1",
    user_state: {
      user_id: "cache_contract_user",
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
      request_source: "cache_contract_test",
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

  let generateCount = 0;
  let deleteCount = 0;
  let setCount = 0;

  const redisStub = {
    store: new Map(),
    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    async set(key, value) {
      setCount += 1;
      this.store.set(key, value);
      return true;
    },
    async delete(key) {
      deleteCount += 1;
      this.store.delete(key);
      return 1;
    },
    async healthCheck() {
      return true;
    },
  };

  registerPlanRoutes(app, {
    redisClient: redisStub,
    generatePlan: async (input) => {
      generateCount += 1;
      return generateMealPlan(input);
    },
  });

  const req = { body: buildDecisionRequest() };
  const cacheKey = require("../src/api/plan.routes").buildIdempotencyKey(req.body);

  redisStub.store.set(cacheKey, JSON.stringify({ version: "DecisionResponse_v1", bad: true }));

  const res = createMockRes();
  await executeHandlers(routes["/plan"], req, res);

  assert(res.statusCode === 200, "Expected /plan to return 200 after cache recompute");
  assert(deleteCount === 1, "Expected invalid cache entry to be deleted");
  assert(generateCount === 1, "Expected pipeline recompute when cache is invalid");
  assert(setCount === 1, "Expected recomputed response to be persisted in cache");

  const responseValidation = validateDecisionResponse(res.body);
  const traceValidation = validateTrace(res.body && res.body.trace);

  assert(responseValidation.valid, `Expected DecisionResponse_v1 contract, got: ${JSON.stringify(responseValidation.errors || [])}`);
  assert(traceValidation.valid, `Expected Trace_v1 contract, got: ${JSON.stringify(traceValidation.errors || [])}`);

  console.log("PASS: invalid cache entry is purged and recomputed response is contract-valid");
})();

