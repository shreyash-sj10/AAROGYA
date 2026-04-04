export function StageCard({ stage, inputCount, outputCount }: { stage: string; inputCount: number; outputCount: number }) {
  return (
    <article className="rounded border border-border bg-card p-3">
      <p className="text-sm font-medium">{stage}</p>
      <p className="mt-1 text-xs text-textSecondary">
        {inputCount}
        {" -> "}
        {outputCount}
      </p>
    </article>
  );
}
