function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function applyAIGate(aiOutput, threshold) {
  const safeOutput = aiOutput && typeof aiOutput === "object" ? aiOutput : null;

  if (!safeOutput) {
    return null;
  }

  const confidence = toSafeNumber(safeOutput.confidence, 0);
  const safeThreshold = toSafeNumber(threshold, 0.6);

  if (confidence < safeThreshold) {
    return null;
  }

  return safeOutput;
}

module.exports = {
  applyAIGate,
};
