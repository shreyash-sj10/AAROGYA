import { useEffect, useState } from "react";
import { SystemInsightsNav } from "@/components/system/SystemInsightsNav";
import {
  systemMetricsApi,
  type SystemMetricsLite,
} from "@/services/api/observability.api";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#2F2F2F]">{value}</p>
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

export function SystemMetricsPage() {
  const [metrics, setMetrics] = useState<SystemMetricsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await systemMetricsApi();
        if (result.error || !result.data) {
          setMetrics(null);
          setError("Unable to process request. Please try a more specific question.");
          return;
        }

        setMetrics(result.data);
      } catch {
        setMetrics(null);
        setError("Metrics endpoint unavailable.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <SystemInsightsNav />
        <div className="rounded-2xl border border-[#E6E1D8] bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Loading metrics...</p>
        </div>
      </section>
    );
  }

  if (error && !metrics) {
    return (
      <section className="space-y-4">
        <SystemInsightsNav />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-800">System Metrics</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SystemInsightsNav />
      <header className="rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#2F2F2F]">System Metrics</h1>
        <p className="mt-2 text-sm text-gray-600">Observability metrics from backend telemetry.</p>
        {error ? <p className="mt-3 text-xs text-amber-700">{error}</p> : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Plans Generated" value={formatInt(metrics?.totalPlansGenerated ?? null)} />
        <MetricCard label="Average Latency" value={formatMs(metrics?.averageLatency ?? null)} />
        <MetricCard label="Success Rate" value={formatPercent(metrics?.successRate ?? null)} />
        <MetricCard label="Average Confidence" value={formatPercent(metrics?.averageConfidence ?? null)} />
      </div>
    </section>
  );
}

