const Ajv = require("ajv");
const { scorePrakritiAnswers } = require("./prakriti.rules");
const { prakritiRequestSchema, prakritiResponseSchema } = require("./prakriti.types");
const { fetchMlPrakriti } = require("../../services/ml/prakritiMlClient");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });
const validatePrakritiRequest = ajv.compile(prakritiRequestSchema);
const validatePrakritiResponse = ajv.compile(prakritiResponseSchema);

function emitPrakritiMlLog(payload, level = "info") {
  const event = {
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  setImmediate(() => {
    console.log(JSON.stringify(event));
  });
}

function formatAjvErrors(errors) {
  return Array.isArray(errors)
    ? errors.map((entry) => ({
      instancePath: entry.instancePath || "",
      schemaPath: entry.schemaPath || "",
      keyword: entry.keyword || "",
      message: entry.message || "validation error",
    }))
    : [];
}

function normalizeScores(scores) {
  const vataScore = Math.max(0, Number(scores && scores.vata) || 0);
  const pittaScore = Math.max(0, Number(scores && scores.pitta) || 0);
  const kaphaScore = Math.max(0, Number(scores && scores.kapha) || 0);
  const total = vataScore + pittaScore + kaphaScore;

  if (total <= 0) {
    return {
      vata: 1 / 3,
      pitta: 1 / 3,
      kapha: 1 / 3,
    };
  }

  const vata = vataScore / total;
  const pitta = pittaScore / total;
  const kapha = 1 - vata - pitta;

  return {
    vata,
    pitta,
    kapha,
  };
}

function blendScores(ruleScore, mlScore) {
  const blended = {
    vata: (0.7 * ruleScore.vata) + (0.3 * mlScore.vata),
    pitta: (0.7 * ruleScore.pitta) + (0.3 * mlScore.pitta),
    kapha: (0.7 * ruleScore.kapha) + (0.3 * mlScore.kapha),
  };

  return normalizeScores(blended);
}

async function estimatePrakriti(input, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const isValidRequest = validatePrakritiRequest(input);
  if (!isValidRequest) {
    const error = new Error("Prakriti request validation failed");
    error.code = "VALIDATION_ERROR";
    error.details = {
      errors: formatAjvErrors(validatePrakritiRequest.errors),
    };
    throw error;
  }

  const scores = scorePrakritiAnswers(input.answers);
  const ruleScore = normalizeScores(scores);

  let finalScore = ruleScore;
  let source = "rule";
  let mlUsed = false;
  let fallbackTriggered = false;

  try {
    const mlScore = await fetchMlPrakriti({
      answers: input.answers,
      symptoms: Array.isArray(input.symptoms) ? input.symptoms : [],
    });

    finalScore = blendScores(ruleScore, mlScore);
    source = "hybrid";
    mlUsed = true;
    emitPrakritiMlLog({
      event: "prakriti_ml_used",
      status: "success",
      request_id: safeOptions.request_id || "",
      trace_id: safeOptions.trace_id || "",
      request_version: safeOptions.request_version || "",
    }, "info");
  } catch (error) {
    // failsafe: keep deterministic rule output when ML is unavailable or invalid
    finalScore = ruleScore;
    source = "rule";
    mlUsed = false;
    fallbackTriggered = true;
    emitPrakritiMlLog({
      event: "prakriti_ml_fallback",
      reason: error instanceof Error ? error.message : "unknown_ml_error",
      request_id: safeOptions.request_id || "",
      trace_id: safeOptions.trace_id || "",
      request_version: safeOptions.request_version || "",
    }, "warn");
  }

  const confidence = Math.max(finalScore.vata, finalScore.pitta, finalScore.kapha);

  const response = {
    vata: finalScore.vata,
    pitta: finalScore.pitta,
    kapha: finalScore.kapha,
    confidence,
    source,
  };

  const isValidResponse = validatePrakritiResponse(response);
  if (!isValidResponse) {
    const error = new Error("Prakriti response validation failed");
    error.code = "RESPONSE_VALIDATION_ERROR";
    error.details = {
      errors: formatAjvErrors(validatePrakritiResponse.errors),
    };
    throw error;
  }

  if (safeOptions.include_debug === true) {
    return {
      ...response,
      ml_used: mlUsed,
      fallback_triggered: fallbackTriggered,
    };
  }

  return response;
}

module.exports = {
  estimatePrakriti,
  formatAjvErrors,
  normalizeScores,
  blendScores,
};




