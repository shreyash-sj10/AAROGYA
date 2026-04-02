function envFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

module.exports = {
  useRAG: envFlag("FF_USE_RAG", true),
  useAdaptiveScoring: envFlag("FF_USE_ADAPTIVE_SCORING", true),
  useAIProfiling: envFlag("FF_USE_AI_PROFILING", true),
  shadowMode: envFlag("FF_SHADOW_MODE", false),
  autoRollbackOnErrorSpike: envFlag("FF_AUTO_ROLLBACK", true),
};
