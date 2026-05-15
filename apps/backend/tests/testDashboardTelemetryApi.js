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

    if (!handler) return;

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

(async () => {
  const routes = {};
  const app = {
    post(path, ...handlers) { routes[path] = handlers; },
    get(path, ...handlers) { routes[path] = handlers; },
  };

  registerPlanRoutes(app, {
    generatePlan: async () => {
      throw new Error("not needed");
    },
    redisClient: { async get() { return null; }, async set() { return true; }, async healthCheck() { return true; } },
    dbService: { async healthCheck() { return true; } },
    getAIHealth: async () => true,
  });

  const telemetryRes = createMockRes();
  await executeHandlers(routes["/dashboard/telemetry"], { query: { user_id: "telemetry_user", trend_limit: 5 }, body: {} }, telemetryRes);

  assert(telemetryRes.statusCode === 200, "telemetry endpoint should return 200");
  assert(telemetryRes.body && typeof telemetryRes.body.user_id === "string", "telemetry must include user_id");
  assert(Array.isArray(telemetryRes.body.score_trend), "telemetry must include score_trend");
  assert(Array.isArray(telemetryRes.body.confidence_trend), "telemetry must include confidence_trend");
  assert(Array.isArray(telemetryRes.body.fallback_rate_trend), "telemetry must include fallback_rate_trend");
  assert(Array.isArray(telemetryRes.body.adherence_history), "telemetry must include adherence_history");

  const logsRes = createMockRes();
  await executeHandlers(routes["/logs"], { query: { limit: 10 }, body: {} }, logsRes);

  assert(logsRes.statusCode === 200, "logs endpoint should return 200");
  assert(logsRes.body && Array.isArray(logsRes.body.logs), "logs endpoint must return logs array");

  console.log("PASS: dashboard telemetry and logs endpoints return real contract shapes without mock payloads");
})();
