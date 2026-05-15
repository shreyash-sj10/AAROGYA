/**
 * Dev-only failure injection (Phase 3). Never active when NODE_ENV=production.
 */
function isProduction() {
  return process.env.NODE_ENV === "production";
}

function simEnabled(name) {
  if (isProduction()) {
    return false;
  }
  return String(process.env[name] || "").toLowerCase() === "true";
}

function simulateDbDown() {
  return simEnabled("SIMULATE_DB_DOWN");
}

function simulateAiTimeout() {
  return simEnabled("SIMULATE_AI_TIMEOUT");
}

function simulateEmptyCandidates() {
  return simEnabled("SIMULATE_EMPTY_CANDIDATES");
}

module.exports = {
  simEnabled,
  simulateDbDown,
  simulateAiTimeout,
  simulateEmptyCandidates,
};
