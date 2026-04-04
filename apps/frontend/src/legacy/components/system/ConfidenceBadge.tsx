export function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const color = level === "high" ? "text-success" : level === "medium" ? "text-warning" : "text-error";
  return <span className={`rounded border border-border px-2 py-1 text-xs ${color}`}>confidence: {level}</span>;
}
