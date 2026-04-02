export function StatusBadge({ status }: { status: "ok" | "degraded" | "error" }) {
  const color = status === "ok" ? "text-success" : status === "degraded" ? "text-warning" : "text-error";
  return <span className={`rounded border border-border px-2 py-1 text-xs ${color}`}>{status}</span>;
}
