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

(async () => {
  const prevUseRedis = process.env.USE_REDIS;
  const prevUseMl = process.env.USE_ML;
  process.env.USE_REDIS = "false";
  process.env.USE_ML = "false";

  const routes = {};
  const app = {
    post() {},
    get(path, ...handlers) {
      routes[path] = handlers;
    },
  };

  const redisStub = {
    async healthCheck() {
      return true;
    },
  };

  registerPlanRoutes(app, {
    generatePlan: async () => ({}),
    redisClient: redisStub,
    dbService: {
      async getDatabaseHealth() {
        return { ok: false, error: "connection refused (test)" };
      },
    },
    getAIHealth: async () => ({ healthy: false }),
  });

  const healthRes = createMockRes();
  await executeHandlers(routes["/health"], {}, healthRes);

  if (prevUseRedis === undefined) {
    delete process.env.USE_REDIS;
  } else {
    process.env.USE_REDIS = prevUseRedis;
  }
  if (prevUseMl === undefined) {
    delete process.env.USE_ML;
  } else {
    process.env.USE_ML = prevUseMl;
  }

  assert(healthRes.statusCode === 503, `expected 503 when DB down, got ${healthRes.statusCode}`);
  const body = healthRes.body;
  assert(body && body.version === "HealthResponse_v1", "expected HealthResponse_v1");
  assert(body.status === "degraded", "expected degraded status");
  assert(body.checks && body.checks.db && body.checks.db.ok === false, "expected checks.db.ok false");
  assert(body.trace && body.trace.version === "Trace_v1", "expected Trace_v1");

  console.log("PASS: /health returns 503 degraded contract when DB is down (optional deps)");
})();
