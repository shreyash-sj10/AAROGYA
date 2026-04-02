export function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded border border-border bg-surface p-3 font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
