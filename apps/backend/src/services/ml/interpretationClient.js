const { parseUserInputDeterministic } = require("../../modules/userState/symptomInterpreter");
const { simulateAiTimeout } = require("../../config/devSimulations");

function normalizeDosha(value) {
  const safeValue = value && typeof value === "object" ? value : {};
  const vata = Math.max(0, Number(safeValue.vata) || 0);
  const pitta = Math.max(0, Number(safeValue.pitta) || 0);
  const kapha = Math.max(0, Number(safeValue.kapha) || 0);
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

async function getMLInterpretation(text) {
  if (simulateAiTimeout()) {
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    throw new Error("AI Boundary Error: simulated AI timeout (SIMULATE_AI_TIMEOUT=true)");
  }

  const safeText = typeof text === "string" ? text.trim() : "";
  if (!safeText) {
    return null;
  }

  const parsed = parseUserInputDeterministic(safeText);

  return {
    prakriti_inference: normalizeDosha(parsed.dosha_estimate),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    signals: Array.isArray(parsed.risk_flags)
      ? parsed.risk_flags.map((flag) => String(flag)).filter(Boolean)
      : [],
  };
}

module.exports = {
  getMLInterpretation,
};
