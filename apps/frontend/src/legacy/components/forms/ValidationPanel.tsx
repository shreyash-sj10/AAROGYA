export function ValidationPanel({ checks }: { checks: Array<{ label: string; pass: boolean }> }) {
  return (
    <div className="rounded border border-border bg-surface p-3 text-sm">
      <p className="mb-2 font-medium">Validation Panel</p>
      <ul className="space-y-1 text-xs">
        {checks.map((check) => (
          <li key={check.label} className={check.pass ? "text-success" : "text-error"}>
            {check.pass ? "PASS" : "FAIL"} {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
