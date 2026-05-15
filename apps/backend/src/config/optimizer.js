function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return fallback;
  }

  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

module.exports = {
  beamWidth: 3,
  useGreedyFallback: true,
  /** Max candidates per template slot considered by beam search (sorted by score first). */
  maxCandidatesPerCategory: readPositiveInt("AAROGYA_OPTIMIZER_MAX_CANDIDATES_PER_CATEGORY", 32),
  /** Hard cap on beam width after env / call-site overrides (prevents accidental huge beams). */
  maxBeamStates: readPositiveInt("AAROGYA_OPTIMIZER_MAX_BEAM_STATES", 12),
  /**
   * If an expansion layer produces more than this many partial combinations, sort once and keep the best slice.
   * Bounded worst-case CPU for adversarial candidate counts.
   */
  maxBeamIntermediateStates: readPositiveInt("AAROGYA_OPTIMIZER_MAX_INTERMEDIATE_STATES", 2500),
};
