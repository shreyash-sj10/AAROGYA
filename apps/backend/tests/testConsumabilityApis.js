const { registerApiRoutes } = require("../src/api/routes");
const foodRepository = require("../src/repositories/food.repository");
const recipeRepository = require("../src/repositories/recipe.repository");

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
    user_id: "consumability_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: ["bloating"],
    dosha_profile: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: ["warm_food"],
    week_context: {
      days: 2,
      start_date: "2026-01-01",
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
      season: "summer",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "consumability_test",
      cache_allowed: true,
      request_id: "consumability_weekly_req",
      trace_id: "consumability_weekly_trace",
    },
  };
}

(async () => {
  assert(typeof foodRepository === "object", "food.repository must export an object");
  assert(typeof recipeRepository === "object", "recipe.repository must export an object");
  assert(typeof foodRepository.listFoods === "function", "food.repository must expose listFoods");
  assert(typeof foodRepository.getFoodById === "function", "food.repository must expose getFoodById");
  assert(typeof recipeRepository.getRecipeById === "function", "recipe.repository must expose getRecipeById");
  assert(
    foodRepository.adapterInfo && foodRepository.adapterInfo.adapter === "in_memory",
    "food.repository must explicitly declare in-memory adapter"
  );
  assert(
    recipeRepository.adapterInfo && recipeRepository.adapterInfo.adapter === "in_memory",
    "recipe.repository must explicitly declare in-memory adapter"
  );

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
    async del(key) {
      this.store.delete(key);
      return 1;
    },
    async healthCheck() {
      return true;
    },
  };

  registerApiRoutes(app, { redisClient: redisStub });

  assert(Array.isArray(routes["/weekly-plan"]), "Expected /weekly-plan route to be registered");
  assert(Array.isArray(routes["/explain"]), "Expected /explain route to be registered");
  assert(Array.isArray(routes["/profile"]), "Expected /profile route to be registered");

  const weeklyReq = { body: buildWeeklyRequest() };
  const weeklyRes = createMockRes();
  await executeHandlers(routes["/weekly-plan"], weeklyReq, weeklyRes);
  assert(weeklyRes.statusCode === 200, "Expected /weekly-plan to return 200");
  assert(weeklyRes.body && weeklyRes.body.version === "WeeklyDecisionResponse_v1", "Expected weekly response contract");

  const explainReq = {
    body: {
      meal_result: {
        meal: ["Mung Dal", "Basmati Rice"],
        score: 0.8,
        breakdown: {
          items: [],
          meta: {},
        },
      },
      user_state: {
        conditions: ["pcos"],
        risk_flags: ["high_gi_sensitive"],
      },
      trace_context: {
        relaxation_applied: false,
      },
    },
  };
  const explainRes = createMockRes();
  await executeHandlers(routes["/explain"], explainReq, explainRes);
  assert(explainRes.statusCode === 200, "Expected /explain to return 200");
  assert(explainRes.body && explainRes.body.version === "AssistantResponse_v1", "Expected AssistantResponse_v1 explain envelope");
  assert(typeof explainRes.body.trace_id === "string" && explainRes.body.trace_id.length > 0, "Expected assistant top-level trace_id");
  assert(explainRes.body && explainRes.body.trace && explainRes.body.trace.version === "Trace_v1", "Assistant response must include Trace_v1");
  assert(explainRes.body && explainRes.body.data && typeof explainRes.body.data.deterministic === "string", "Expected validated explain response");

  const profileReq = {
    body: {
      user_input: "I feel acidity and heaviness",
      threshold: 0.6,
    },
  };
  const profileRes = createMockRes();
  await executeHandlers(routes["/profile"], profileReq, profileRes);
  assert(profileRes.statusCode === 200, "Expected /profile to return 200");
  assert(profileRes.body && profileRes.body.version === "AssistantResponse_v1", "Expected AssistantResponse_v1 profile envelope");
  assert(typeof profileRes.body.trace_id === "string" && profileRes.body.trace_id.length > 0, "Expected assistant top-level trace_id");
  assert(profileRes.body && profileRes.body.trace && profileRes.body.trace.version === "Trace_v1", "Assistant response must include Trace_v1");
  assert(profileRes.body && profileRes.body.data && profileRes.body.data.version === "AIProfileOutput_v1", "Expected validated profile response");

  console.log("PASS: repositories are consumable and trace policy is enforced for assistant endpoints");
})();


