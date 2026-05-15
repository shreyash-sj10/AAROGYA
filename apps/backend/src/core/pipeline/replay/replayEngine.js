const crypto = require("crypto");
const { executeGeneratePlanCore } = require("../orchestrator");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function canonicalizeOutput(output) {
  const safe = toSafeObject(output);
  const clone = JSON.parse(JSON.stringify(safe));
  const meta = toSafeObject(clone.meta);
  meta.latency_ms = 0;
  clone.meta = meta;
  return clone;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function replayAndVerify(originalRequest, storedTrace, storedOutput = null) {
  const replayOutput = await executeGeneratePlanCore(toSafeObject(originalRequest));
  const replayTrace = toSafeObject(replayOutput).trace;

  const expectedTraceHash = stableHash(toSafeObject(storedTrace));
  const replayTraceHash = stableHash(replayTrace);

  if (expectedTraceHash !== replayTraceHash) {
    throw new Error("Replay verification failed: trace mismatch");
  }

  if (storedOutput && typeof storedOutput === "object") {
    const expectedOutputHash = stableHash(canonicalizeOutput(storedOutput));
    const replayOutputHash = stableHash(canonicalizeOutput(replayOutput));

    if (expectedOutputHash !== replayOutputHash) {
      throw new Error("Replay verification failed: output mismatch");
    }
  }

  return {
    replayOutput,
    replayTrace,
    traceHash: replayTraceHash,
    outputHash: stableHash(canonicalizeOutput(replayOutput)),
  };
}

module.exports = {
  replayAndVerify,
  stableHash,
};
