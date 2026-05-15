const { QUESTIONS } = require("./questions");

/**
 * Detects uncertainty signals from a request/response pair.
 */
function detectUncertainty(request, response) {
  const signals = [];
  const req = request || {};
  const res = response || {};
  const userState = req.user_state || {};
  const trace = res.trace || {};
  const safeTrace = trace.safe || trace;
  const stages = safeTrace.stages || {};
  const reliability = stages.reliability_engine || {};

  // 1. Missing Critical Fields
  if (!userState.symptoms || userState.symptoms.length === 0) {
    signals.push("MISSING_SYMPTOMS");
  }
  if (!userState.goals || userState.goals.length === 0) {
    signals.push("MISSING_GOALS");
  }

  // 2. Default/Unknown Dosha (all 0.33)
  const dosha = userState.dosha_estimate || {};
  if (Math.abs(dosha.vata - 0.333333) < 0.01 && Math.abs(dosha.pitta - 0.333333) < 0.01) {
    signals.push("DEFAULT_DOSHA");
  }

  // 3. High Relaxation (level >= 2)
  if (reliability.relaxation_level >= 2) {
    signals.push("HIGH_RELAXATION");
  }

  // 4. Low Confidence (< 0.6)
  if (res.confidence && res.confidence.value < 0.6) {
    signals.push("LOW_CONFIDENCE");
  }

  return signals;
}

/**
 * Selects the next question based on a priority queue of signals.
 */
function selectNextQuestion(signals) {
  if (!signals || signals.length === 0) return null;

  // Priority queue: Missing information > High relaxation > Low confidence
  if (signals.includes("MISSING_SYMPTOMS")) return QUESTIONS.CLARIFY_SYMPTOMS;
  if (signals.includes("MISSING_GOALS")) return QUESTIONS.CLARIFY_GOALS;
  if (signals.includes("DEFAULT_DOSHA")) return QUESTIONS.CLARIFY_PITTA;
  if (signals.includes("HIGH_RELAXATION")) return QUESTIONS.BROADEN_PREFERENCES;
  
  // Generic fallback if confidence is low but no specific signal triggered
  if (signals.includes("LOW_CONFIDENCE")) return QUESTIONS.CLARIFY_SYMPTOMS;

  return null;
}

module.exports = {
  detectUncertainty,
  selectNextQuestion
};
