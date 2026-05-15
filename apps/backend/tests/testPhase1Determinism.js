const crypto = require("crypto");
const { _runPipelineInternal } = require("../src/core/pipeline/pipeline");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function canonicalize(result) {
  const safe = JSON.parse(JSON.stringify(result));
  if (safe && safe.timings) {
    safe.timings.pipeline_ms = 0;
    safe.timings.optimizer_ms = 0;
  }
  return safe;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildInput() {
  return {
    mealType: "lunch",
    foods: JSON.parse(JSON.stringify(sampleFoods)),
    rules: JSON.parse(JSON.stringify(sampleRules)),
    constraints: { max_calories: 650, diet_type: "vegetarian" },
    userState: {
      user_id: "phase1_determinism_user",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    userHistory: {
      recentFoods: [],
      categoryCount: {},
    },
    context: {
      history: [],
    },
  };
}

(() => {
  const first = _runPipelineInternal(buildInput());
  const baseline = hash(canonicalize(first));

  for (let i = 0; i < 10; i += 1) {
    const next = _runPipelineInternal(buildInput());
    assert(hash(canonicalize(next)) === baseline, `pipeline output changed at iteration ${i + 1}`);
  }

  console.log("PASS: deterministic pipeline output remained stable for identical input");
})();
