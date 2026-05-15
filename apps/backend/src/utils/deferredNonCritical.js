/**
 * Phase 6 — optional deferral of non-critical work (setImmediate).
 * Enable with AAROGYA_DEFER_NON_CRITICAL=true. Tasks must swallow their own errors;
 * this wrapper logs failures to avoid unhandled rejections.
 */
function runDeferredNonCritical(fn) {
  if (typeof fn !== "function") {
    return;
  }

  if (process.env.AAROGYA_DEFER_NON_CRITICAL !== "true") {
    fn();
    return;
  }

  setImmediate(() => {
    try {
      fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || "unknown");
      console.error(`[deferred_non_critical] ${message}`);
    }
  });
}

module.exports = {
  runDeferredNonCritical,
};
