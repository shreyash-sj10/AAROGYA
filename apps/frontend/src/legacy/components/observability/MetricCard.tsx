export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </article>
  );
}
