type StageRow = {
  key: string;
  label: string;
  input: number;
  output: number;
  highlight?: "p0" | "optimizer" | "reliability";
};

type TracePipelineStripProps = {
  stages: StageRow[];
};

function barWidth(input: number, output: number): string {
  if (input <= 0) return "0%";
  const pct = Math.min(100, Math.round((output / input) * 100));
  return `${Math.max(output > 0 ? 8 : 0, pct)}%`;
}

export function TracePipelineStrip({ stages }: TracePipelineStripProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {stages.map((stage) => {
        const borderAccent =
          stage.highlight === "p0"
            ? "border-l-emerald-500"
            : stage.highlight === "optimizer"
              ? "border-l-indigo-500"
              : stage.highlight === "reliability"
                ? "border-l-amber-500"
                : "border-l-slate-300";

        return (
          <li
            key={stage.key}
            className={`rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-3 ${borderAccent}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stage.label}</p>
            <p className="mt-1 font-mono text-xs text-slate-800">
              <span className="font-semibold">{stage.output}</span>
              <span className="text-slate-400"> out / </span>
              <span>{stage.input} in</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500/80"
                style={{ width: barWidth(stage.input, stage.output) }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
