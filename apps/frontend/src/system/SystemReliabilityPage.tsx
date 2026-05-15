import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  systemMetricsApi,
  systemLogsApi,
  type SystemMetricsLite,
  type SystemLogEntry,
} from "@/services/api/observability.api";
import { usePlanStore } from "@/store/plan.store";
import { SystemInsightsNav } from "@/components/system/SystemInsightsNav";
import {
  canonicalMealFingerprints,
  canonicalTraceForHash,
  hashPayload,
  stripVolatileMeta,
} from "@/utils/determinismHash";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#2F2F2F]">{value}</p>
      {hint ? <p className="mt-2 text-[11px] text-gray-500">{hint}</p> : null}
    </article>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }
  return `${value.toFixed(1)}%`;
}

function formatMs(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }
  return `${value.toFixed(0)} ms`;
}

function formatInt(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }
  return `${Math.round(value)}`;
}

function formatBool(value: boolean | null): string {
  if (value === null) {
    return "Unavailable";
  }
  return value ? "Yes" : "No";
}

function logMentionsP0Violations(entry: SystemLogEntry): boolean {
  const blob = JSON.stringify(entry.metadata || {}).toLowerCase();
  return blob.includes("p0_violation") || blob.includes("p0_violations");
}

function stripRequestMetaNoise(req: DecisionRequestV1): DecisionRequestV1 {
  const next = JSON.parse(JSON.stringify(req)) as DecisionRequestV1;
  if (next.meta && typeof next.meta === "object") {
    const m = { ...next.meta } as Record<string, unknown>;
    delete m.latency_ms;
    delete m.served_latency_ms;
    next.meta = m as DecisionRequestV1["meta"];
  }
  return next;
}

export function SystemReliabilityPage() {
  const plan = usePlanStore((s) => s.plan);
  const lastRequest = usePlanStore((s) => s.lastDecisionRequest);

  const [metrics, setMetrics] = useState<SystemMetricsLite | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hashes, setHashes] = useState<{ label: string; hash: string }[] | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mRes, lRes] = await Promise.all([systemMetricsApi(), systemLogsApi(40)]);
        if (mRes.error || !mRes.data) {
          setMetrics(null);
          setError("Metrics unavailable.");
        } else {
          setMetrics(mRes.data);
        }
        setLogs(lRes.data && !lRes.error ? lRes.data : []);
      } catch {
        setMetrics(null);
        setLogs([]);
        setError("Observability endpoints unavailable.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!plan) {
      setHashes(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const stripped = stripVolatileMeta(plan);
      const traceCanon = canonicalTraceForHash(stripped.trace);
      const meals = canonicalMealFingerprints(stripped);
      const reqRow = lastRequest
        ? hashPayload("request (canonical)", stripRequestMetaNoise(lastRequest))
        : Promise.resolve({ label: "request", hash: "— (generate from Planner to capture)" });
      const h = await Promise.all([
        reqRow,
        hashPayload("trace", traceCanon),
        hashPayload("meal_plan", meals),
      ]);
      if (!cancelled) {
        setHashes(h);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [plan, lastRequest]);

  const p0SignalCount = useMemo(() => logs.filter(logMentionsP0Violations).length, [logs]);

  if (loading) {
    return (
      <section className="space-y-4">
        <SystemInsightsNav />
        <div className="rounded-2xl border border-[#E6E1D8] bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Loading reliability view...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SystemInsightsNav />

      <header className="rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#2F2F2F]">Reliability & determinism</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Live counters from <code className="rounded bg-white/80 px-1">GET /metrics</code>, recent{" "}
          <code className="rounded bg-white/80 px-1">GET /logs</code> for P0-related signals, and client-side hashes of the latest single-meal plan in your session (when available).
        </p>
        {error ? <p className="mt-3 text-xs text-amber-700">{error}</p> : null}
      </header>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reliability (metrics)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Strict success (API)" value={formatPercent(metrics?.successRate ?? null)} hint="(requests − API errors) / requests" />
          <MetricCard label="Engine fallback %" value={formatPercent(metrics?.engineFallbackRatePercent ?? null)} hint="AI assistive fallback share (process lifetime)" />
          <MetricCard label="AI layer fallback %" value={formatPercent(metrics?.aiLayerFallbackRatePercent ?? null)} hint="Downstream model client fallbacks" />
          <MetricCard label="Last plan used fallback" value={formatBool(metrics?.lastUsedFallback ?? null)} hint="Most recent recorded request" />
          <MetricCard label="Avg pipeline ms" value={formatMs(metrics?.avgPipelineMs ?? null)} />
          <MetricCard label="Avg optimizer ms" value={formatMs(metrics?.avgOptimizerMs ?? null)} />
          <MetricCard label="AI schema compliance" value={formatPercent(metrics?.aiSchemaCompliancePercent ?? null)} />
          <MetricCard label="AI invalid response %" value={formatPercent(metrics?.aiInvalidResponsePercent ?? null)} />
          <MetricCard label="Optimizer failures (count)" value={formatInt(metrics?.optimizerFailureCount ?? null)} />
          <MetricCard label="Schema validation failures" value={formatInt(metrics?.schemaValidationFailedCount ?? null)} />
          <MetricCard label="Total plans (counter)" value={formatInt(metrics?.totalPlansGenerated ?? null)} />
          <MetricCard label="Avg latency" value={formatMs(metrics?.averageLatency ?? null)} />
          <MetricCard label="P0 trace flag rate" value={formatPercent(metrics?.p0TraceFlagPercent ?? null)} hint="Plans with trace p0_violations &gt; 0 / total plans" />
          <MetricCard
            label="Avg relaxation level"
            value={metrics?.avgRelaxationLevel != null ? metrics.avgRelaxationLevel.toFixed(2) : "Unavailable"}
            hint="From reliability_engine (rolling avg)"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Logs — P0 signal (heuristic)</h2>
        <p className="mt-2 text-sm text-gray-600">
          Entries whose metadata mentions P0 violations: <span className="font-semibold text-[#2F2F2F]">{p0SignalCount}</span> / {logs.length} loaded.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Prefer the <strong>P0 trace flag rate</strong> card above for a process-wide counter; logs remain useful for spot checks.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Determinism strip (latest single meal)</h2>
          <Link
            to="/app/trace"
            className="rounded-lg border border-[#d6c7ac] bg-[#F5F1E8] px-3 py-1.5 text-xs font-semibold text-[#4e4534] hover:bg-[#ebe4d4]"
          >
            Open trace explorer
          </Link>
        </div>
        {!plan ? (
          <p className="mt-3 text-sm text-gray-600">No single-meal plan in session. Generate from Planner to populate hashes.</p>
        ) : hashes ? (
          <ul className="mt-4 space-y-3 font-mono text-[11px] text-gray-800">
            {hashes.map((row) => (
              <li key={row.label} className="break-all rounded-lg bg-[#FAF8F3] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{row.label}</div>
                <div className="mt-1">{row.hash}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-600">Computing hashes…</p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Verified deterministic flag: use <strong>Replay</strong> / <strong>Test determinism</strong> on the trace page when those backend routes are enabled.
        </p>
      </div>
    </section>
  );
}
