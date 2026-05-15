const { validateAIProfile } = require("../../contracts/validators/validateAIProfile");
const { applyAIGate } = require("./ai.gate");
const { parseUserInputDeterministic } = require("../userState/symptomInterpreter");
const FEATURE_FLAGS = require("../../config/featureFlags");
const {
  logLLMValidation,
  logLLMFallback,
} = require("../../observability/llm.logger");

const AI_CONFIDENCE_THRESHOLD = 0.6;

const KNOWN_RISK_FLAGS = new Set([
  "high_pitta",
  "high_vata",
  "high_kapha",
  "digestion_weak",
  "high_gi_sensitive",
  "avoid_heavy_food",
  "low_agni",
]);

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toRiskFlagIds(value) {
  return Array.from(new Set(
    toSafeArray(value)
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item && KNOWN_RISK_FLAGS.has(item))
  ));
}

function normalizeDosha(value) {
  const safeValue = value && typeof value === "object" ? value : {};
  const vata = Math.max(0, toSafeNumber(safeValue.vata, 0));
  const pitta = Math.max(0, toSafeNumber(safeValue.pitta, 0));
  const kapha = Math.max(0, toSafeNumber(safeValue.kapha, 0));
  const sum = vata + pitta + kapha;

  if (sum <= 0) {
    return { vata: 0.34, pitta: 0.33, kapha: 0.33 };
  }

  const nv = Number((vata / sum).toFixed(6));
  const np = Number((pitta / sum).toFixed(6));

  return {
    vata: nv,
    pitta: np,
    kapha: Number((1 - nv - np).toFixed(6)),
  };
}

function buildFallbackProfile(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const parsed = parseUserInputDeterministic(String(safeInput.userInput || safeInput.text || safeInput.input || ""));

  return {
    version: "AIProfileOutput_v1",
    schema_version: 1,
    compatibility: "backward",
    risk_flags: toRiskFlagIds(parsed.risk_flags),
    dosha_estimate: normalizeDosha(parsed.dosha_estimate),
    confidence: Math.max(0, Math.min(1, toSafeNumber(parsed.confidence, 0.5))),
  };
}

function resolveProfileFromInputSync({ userInput, aiOutput, threshold } = {}) {
  if (!FEATURE_FLAGS.useAIProfiling) {
    throw new Error("AI profiling is disabled");
  }

  const fallback = buildFallbackProfile({ userInput, aiOutput });
  const validation = validateAIProfile(fallback);

  logLLMValidation({
    endpoint: "ai/profile",
    request_id: "ai_profile_sync",
    valid: validation.valid,
    errors: validation.errors || [],
  });

  if (!validation.valid) {
    logLLMFallback({ endpoint: "ai/profile", request_id: "ai_profile_sync", reason: "schema_validation_failed" });
    throw new Error("AI profile schema validation failed");
  }

  const gated = applyAIGate(fallback, typeof threshold === "number" ? threshold : AI_CONFIDENCE_THRESHOLD);

  if (!gated) {
    logLLMFallback({ endpoint: "ai/profile", request_id: "ai_profile_sync", reason: "confidence_below_threshold" });
    throw new Error("AI profile confidence below threshold");
  }

  return gated;
}

async function buildUserProfile(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const threshold = toSafeNumber(safeInput.threshold, AI_CONFIDENCE_THRESHOLD);

  if (!FEATURE_FLAGS.useAIProfiling) {
    throw new Error("AI profiling is disabled");
  }

  const fallback = buildFallbackProfile(safeInput);
  const validation = validateAIProfile(fallback);

  logLLMValidation({
    endpoint: "ai/profile",
    request_id: "ai_profile_async",
    valid: validation.valid,
    errors: validation.errors || [],
  });

  if (!validation.valid) {
    logLLMFallback({ endpoint: "ai/profile", request_id: "ai_profile_async", reason: "schema_validation_failed" });
    throw new Error("AI profile schema validation failed");
  }

  const gated = applyAIGate(fallback, threshold);
  if (!gated) {
    logLLMFallback({ endpoint: "ai/profile", request_id: "ai_profile_async", reason: "confidence_below_threshold" });
    throw new Error("AI profile confidence below threshold");
  }

  return gated;
}

module.exports = {
  buildUserProfile,
  resolveProfileFromInputSync,
  buildFallbackProfile,
};
