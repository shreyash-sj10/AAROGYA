const crypto = require("crypto");
const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function canonicalizeOutput(output) {
  const safe = output && typeof output === "object" ? { ...output } : {};
  const meta = safe.meta && typeof safe.meta === "object" ? { ...safe.meta } : {};
  meta.latency_ms = 0;
  safe.meta = meta;
  return safe;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function baseInput() {
  return {
    request_id: "determinism_strict_request",
    trace_id: "determinism_strict_trace",
    mealType: "lunch",
    foods: sampleFoods,
    rules: sampleRules,
    userHistory: {
      recentFoods: ["mung dal"],
      categoryCount: { dal: 1 },
    },
    userState: {
      user_id: "determinism_user",
      goals: ["GOAL_MAINTENANCE"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" },
    },
    meta: {
      timestamp: 1711929600,
      request_source: "proof_test",
      cache_allowed: false,
    },
  };
}

(function runDeterminismStrict() {
  const input = baseInput();
  const first = executeGeneratePlanCore(input);
  const firstOutputHash = hash(canonicalizeOutput(first));
  const firstTraceHash = hash(first.trace);
  const firstScore = first.score;

  for (let i = 0; i < 100; i += 1) {
    const current = executeGeneratePlanCore(input);
    assert(hash(canonicalizeOutput(current)) === firstOutputHash, `output hash mismatch at run ${i + 1}`);
    assert(hash(current.trace) === firstTraceHash, `trace hash mismatch at run ${i + 1}`);
    assert(current.score === firstScore, `score mismatch at run ${i + 1}`);
  }

  console.log("PASS: strict determinism + trace checksum validated across 100 runs");
})();

