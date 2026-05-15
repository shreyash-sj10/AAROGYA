const { toSafeNumber } = require("../utils/safeUtils");

function escHelp(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, " ");
}

/**
 * Minimal OpenMetrics-style exposition for Grafana/Prometheus (Phase 3).
 */
function formatPrometheusText(snap) {
  const s = snap && typeof snap === "object" ? snap : {};
  const lines = [];

  const helpType = (name, help, type) => {
    lines.push(`# HELP ${name} ${escHelp(help)}`);
    lines.push(`# TYPE ${name} ${type}`);
  };

  helpType("aarogya_api_requests_total", "HTTP API requests seen by telemetry middleware", "counter");
  lines.push(`aarogya_api_requests_total ${Math.trunc(toSafeNumber(s.api_request_count, 0))}`);

  helpType("aarogya_api_errors_total", "HTTP API responses with status >= 400", "counter");
  lines.push(`aarogya_api_errors_total ${Math.trunc(toSafeNumber(s.api_error_count, 0))}`);

  helpType("aarogya_plans_total", "Successful meal plan generations (orchestrator)", "counter");
  lines.push(`aarogya_plans_total ${Math.trunc(toSafeNumber(s.request_count, 0))}`);

  helpType("aarogya_plan_latency_ms_avg", "Average end-to-end plan latency (ms)", "gauge");
  lines.push(`aarogya_plan_latency_ms_avg ${toSafeNumber(s.avg_latency, 0)}`);

  helpType("aarogya_plan_latency_ms_p95", "p95 plan latency (ms)", "gauge");
  lines.push(`aarogya_plan_latency_ms_p95 ${toSafeNumber(s.p95_latency, 0)}`);

  helpType("aarogya_pipeline_ms_avg", "Average pipeline time (ms)", "gauge");
  lines.push(`aarogya_pipeline_ms_avg ${toSafeNumber(s.avg_pipeline_ms, 0)}`);

  helpType("aarogya_optimizer_ms_avg", "Average optimizer time (ms)", "gauge");
  lines.push(`aarogya_optimizer_ms_avg ${toSafeNumber(s.avg_optimizer_ms, 0)}`);

  helpType("aarogya_fallback_rate", "Share of API requests that used engine fallback (0–1)", "gauge");
  lines.push(`aarogya_fallback_rate ${toSafeNumber(s.fallback_rate, 0)}`);

  const err = s.errors && typeof s.errors === "object" ? s.errors : {};
  helpType("aarogya_errors_total", "Orchestrator / contract error counters by type", "counter");
  Object.keys(err).forEach((k) => {
    lines.push(`aarogya_errors_total{error_type="${k}"} ${Math.trunc(toSafeNumber(err[k], 0))}`);
  });

  const eh = s.engine_health && typeof s.engine_health === "object" ? s.engine_health : {};
  helpType("aarogya_p0_violation_plans_total", "Plans where trace recorded P0 violations > 0", "counter");
  lines.push(`aarogya_p0_violation_plans_total ${Math.trunc(toSafeNumber(eh.p0_violation_plans_total, 0))}`);

  helpType("aarogya_avg_relaxation_level", "Rolling average relaxation level from reliability", "gauge");
  lines.push(`aarogya_avg_relaxation_level ${toSafeNumber(eh.avg_relaxation_level, 0)}`);

  const os = s.optimizer_search && typeof s.optimizer_search === "object" ? s.optimizer_search : {};
  helpType("aarogya_optimizer_beam_expansions_total", "Beam search partial combination expansions (sum of layers)", "counter");
  lines.push(`aarogya_optimizer_beam_expansions_total ${Math.trunc(toSafeNumber(os.beam_layer_expansions_total, 0))}`);

  helpType("aarogya_optimizer_beam_prune_events_total", "Beam search intermediate pool prune events", "counter");
  lines.push(`aarogya_optimizer_beam_prune_events_total ${Math.trunc(toSafeNumber(os.beam_prune_events_total, 0))}`);

  const ai = s.ai_metrics && typeof s.ai_metrics === "object" ? s.ai_metrics : {};
  helpType("aarogya_ai_schema_compliance", "AI layer schema compliance rate (0–1)", "gauge");
  lines.push(`aarogya_ai_schema_compliance ${toSafeNumber(ai.schema_compliance_rate, 0)}`);

  lines.push("");
  return lines.join("\n");
}

module.exports = {
  formatPrometheusText,
};
