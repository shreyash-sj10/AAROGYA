import { useEffect, useState } from "react";
import { SystemInsightsNav } from "@/components/system/SystemInsightsNav";
import {
  systemLogsApi,
  type SystemLogEntry,
} from "@/services/api/observability.api";

function formatMeta(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "-";
  }

  return entries
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

export function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await systemLogsApi();
        if (result.error || !result.data) {
          setLogs([]);
          setError("Unable to process request. Please try a more specific question.");
          return;
        }

        setLogs(result.data);
      } catch {
        setLogs([]);
        setError("Logs endpoint unavailable.");
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
          <p className="text-sm text-gray-600">Loading logs...</p>
        </div>
      </section>
    );
  }

  if (error && logs.length === 0) {
    return (
      <section className="space-y-4">
        <SystemInsightsNav />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-800">System Logs</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SystemInsightsNav />
      <header className="rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#2F2F2F]">System Logs</h1>
        <p className="mt-2 text-sm text-gray-600">Event stream from backend observability routes.</p>
        {error ? <p className="mt-3 text-xs text-amber-700">{error}</p> : null}
      </header>

      <section className="max-h-[65vh] overflow-y-auto rounded-2xl border border-[#E6E1D8] bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-600">No logs available.</p>
          ) : (
            logs.map((entry, idx) => (
              <article key={`${entry.timestamp}-${entry.actionType}-${idx}`} className="rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-4">
                <p className="text-xs text-gray-500">{entry.timestamp}</p>
                <p className="mt-1 text-sm font-semibold text-[#2F2F2F]">{entry.actionType}</p>
                <p className="mt-2 text-xs text-gray-600">{formatMeta(entry.metadata)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

