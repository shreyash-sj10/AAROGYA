const { registerApiRoutes } = require("../src/api/routes");

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

function buildValidRequest() {
  return {
    answers: {
      body_build: "thin",
      skin: "dry",
      appetite: "strong",
      energy: "variable",
      nature: "calm",
      sleep: "light",
      climate: "cool",
      food_response: "acidic",
      work_style: "steady",
      weight: "stable",
    },
    symptoms: ["bloating"],
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

  registerApiRoutes(app, {});

  assert(Array.isArray(routes["/prakriti/estimate"]), "Expected /prakriti/estimate route to be registered");
  assert(Array.isArray(routes["/api/prakriti/estimate"]), "Expected /api/prakriti/estimate route to be registered");

  const validReq = { body: buildValidRequest() };
  const validRes = createMockRes();
  await executeHandlers(routes["/prakriti/estimate"], validReq, validRes);

  assert(validRes.statusCode === 200, "Expected valid prakriti request to return 200");
  assert(validRes.body && ["rule", "hybrid"].includes(validRes.body.source), "Expected source to be rule or hybrid");

  const sum = Number(validRes.body.vata) + Number(validRes.body.pitta) + Number(validRes.body.kapha);
  assert(Math.abs(sum - 1) < 0.000001, "Expected dosha values to sum to 1");

  const confidence = Math.max(validRes.body.vata, validRes.body.pitta, validRes.body.kapha);
  assert(Math.abs(confidence - validRes.body.confidence) < 0.000001, "Expected confidence to match max dosha value");

  const invalidReq = {
    body: {
      answers: {
        ...buildValidRequest().answers,
        body_build: "invalid_enum",
      },
    },
  };

  const invalidRes = createMockRes();
  await executeHandlers(routes["/api/prakriti/estimate"], invalidReq, invalidRes);

  assert(invalidRes.statusCode === 400, "Expected invalid enum request to return 400");
  assert(invalidRes.body && invalidRes.body.error && invalidRes.body.error.code === "VALIDATION_ERROR", "Expected validation error response");

  console.log("PASS: /prakriti/estimate validates input and returns normalized deterministic response");
})();
