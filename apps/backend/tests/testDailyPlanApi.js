const { registerPlanRoutes } = require("../src/api/plan.routes");
const { generateDailyPlan } = require("../src/services/dailyPlan.service");
const { buildDecisionResponse } = require("../src/contracts/builders/decisionResponse.builder");

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
    if (error) throw error;

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

function buildDecisionRequest() {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: "daily_api_req_1",
    trace_id: "daily_api_trace_1",
    user_state: {
      user_id: "daily_api_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: ["warm_food"],
      context: {
        meal_type: "breakfast",
        season: "summer",
      },
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "daily_api_test",
      cache_allowed: false,
    },
  };
}

function buildInternalInput() {
  return {
    request_id: "daily_internal_req",
    trace_id: "daily_internal_trace",
    mealType: "breakfast",
    userState: {
      user_id: "daily_internal_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: ["warm_food"],
      diet_type: "vegetarian",
      context: {
        meal_type: "breakfast",
        season: "summer",
      },
    },
    constraints: {
      max_calories: 650,
      diet_type: "vegetarian",
    },
    foods: [],
    rules: [],
    userHistory: {},
    context: {
      meal_type: "breakfast",
      season: "summer",
    },
    meta: {
      timestamp: 1711929600,
      request_source: "daily_api_test",
      cache_allowed: false,
      model_version: "assistive_offline_v1",
      prompt_version: "prompt_v1",
      rules_version: "rules_v1",
    },
  };
}

function buildStubDecisionResponse({ mealType, recipeId, name, score, confidenceValue }) {
  return buildDecisionResponse({
    request: {
      request_id: `req_${mealType}`,
      trace_id: `trace_${mealType}`,
      meta: {
        timestamp: 1711929600,
      },
    },
    internal: {
      mealPlan: [
        {
          recipe_id: recipeId,
          name,
          quantity: { value: 1, unit: "serving" },
        },
      ],
      score,
      nutrition_summary: {
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
      },
      confidence: {
        value: confidenceValue,
        components: {
          penalty_impact: 0.1,
          diversity_impact: 0.1,
          relaxation_impact: 0.1,
        },
      },
      explanation: {
        deterministic: `${mealType} selected by deterministic stub`,
        ai_explanation: "",
        citations: [],
      },
      insights: [],
      warnings: [],
      meta: {
        latency_ms: 1,
        cache_hit: false,
        model_version: "assistive_offline_v1",
        prompt_version: "prompt_v1",
        rules_version: "rules_v1",
      },
    },
    stageStats: {
      interpretation_layer: {
        ml_used: false,
        ml_confidence: 0,
        ml_contribution_weight: 0,
      },
      candidate_generator: { input_count: 1, output_count: 1 },
      constraint_engine: {
        input_count: 1,
        output_count: 1,
        rejected: 0,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      },
      scoring_engine: { input_count: 1, output_count: 1 },
      diversity_engine: {
        input_count: 1,
        output_count: 1,
        historical_matches_count: 0,
        diversity_penalty_applied: 0,
      },
      optimizer: {
        input_count: 1,
        output_count: 1,
        combinations_evaluated: 1,
        selected_score: score,
      },
      reliability_engine: {
        input_count: 1,
        output_count: 1,
        relaxation_level: 0,
        relaxed_priorities: [],
        confidence_eval: {
          relaxation_impact: 1,
          pool_quality: 1,
          score_confidence: 1,
          penalty_impact: 1,
          diversity_impact: 1,
        },
      },
    },
  });
}

function createDeterministicRunPlan() {
  return async function runPlan(input) {
    const mealType = input && input.mealType;
    const history = Array.isArray(input && input.context && input.context.history)
      ? input.context.history
      : [];
    const used = new Set(history.map((entry) => entry && entry.meal_id).filter(Boolean));

    if (mealType === "breakfast") {
      return buildStubDecisionResponse({
        mealType,
        recipeId: "upma",
        name: "Vegetable Upma",
        score: 0.82,
        confidenceValue: 0.84,
      });
    }

    if (mealType === "lunch") {
      const lunchId = used.has("upma") ? "dal_rice" : "khichdi";
      const lunchName = lunchId === "dal_rice" ? "Dal Rice" : "Moong Khichdi";
      return buildStubDecisionResponse({
        mealType,
        recipeId: lunchId,
        name: lunchName,
        score: 0.79,
        confidenceValue: 0.8,
      });
    }

    const dinnerId = used.has("dal_rice") ? "veg_soup" : "roti_sabzi";
    const dinnerName = dinnerId === "veg_soup" ? "Vegetable Soup" : "Roti Sabzi";
    return buildStubDecisionResponse({
      mealType,
      recipeId: dinnerId,
      name: dinnerName,
      score: 0.76,
      confidenceValue: 0.78,
    });
  };
}

function createFailingRunPlan() {
  return async function runPlan(input) {
    const mealType = input && input.mealType;
    if (mealType === "lunch") {
      throw new Error("No valid plan under constraints");
    }

    return buildStubDecisionResponse({
      mealType,
      recipeId: `${mealType}_ok`,
      name: `${mealType} meal`,
      score: 0.7,
      confidenceValue: 0.7,
    });
  };
}

function buildDeps(runPlan) {
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

  return {
    redisClient: redisStub,
    adaptDecisionRequest: () => buildInternalInput(),
    generatePlan: runPlan,
    generateDailyPlan,
  };
}

async function runDeterminismCase() {
  const routes = {};
  const app = {
    post(path, ...handlers) { routes[path] = handlers; },
    get(path, ...handlers) { routes[path] = handlers; },
  };

  registerPlanRoutes(app, buildDeps(createDeterministicRunPlan()));

  assert(Array.isArray(routes["/plan/daily"]) && routes["/plan/daily"].length === 2, "Route /plan/daily must register middleware + handler");

  const req = { body: buildDecisionRequest() };
  const res1 = createMockRes();
  await executeHandlers(routes["/plan/daily"], req, res1);

  assert(res1.statusCode === 200, "Expected /plan/daily determinism run 1 to return 200");
  assert(res1.body && res1.body.meals, "Expected /plan/daily body to include meals");

  const ids = [
    res1.body.meals.breakfast.meal_plan[0].recipe_id,
    res1.body.meals.lunch.meal_plan[0].recipe_id,
    res1.body.meals.dinner.meal_plan[0].recipe_id,
  ];
  assert(new Set(ids).size === ids.length, "Expected unique foods across breakfast/lunch/dinner for basic diversity");

  const res2 = createMockRes();
  await executeHandlers(routes["/plan/daily"], req, res2);

  assert(res2.statusCode === 200, "Expected /plan/daily determinism run 2 to return 200");
  assert(JSON.stringify(res1.body) === JSON.stringify(res2.body), "Expected same input to produce identical daily output");
}

async function runFailLoudCase() {
  const routes = {};
  const app = {
    post(path, ...handlers) { routes[path] = handlers; },
    get(path, ...handlers) { routes[path] = handlers; },
  };

  registerPlanRoutes(app, buildDeps(createFailingRunPlan()));

  const req = { body: buildDecisionRequest() };
  const res = createMockRes();
  await executeHandlers(routes["/plan/daily"], req, res);

  assert(res.statusCode === 422, "Expected /plan/daily to fail loudly with 422 when one meal fails");
  assert(res.body && res.body.error && res.body.error.code === "NO_VALID_PLAN", "Expected NO_VALID_PLAN fail-loud error");
  assert(!(res.body && res.body.meals), "Expected no partial daily meals in fail-loud response");
}

(async () => {
  await runDeterminismCase();
  await runFailLoudCase();
  console.log("PASS: /plan/daily deterministic + fail-loud behavior validated");
})().catch((error) => {
  console.error("FAIL: /plan/daily test failed");
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
