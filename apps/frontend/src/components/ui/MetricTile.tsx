import type { ReactNode } from "react";

type MetricTileProps = {
  label: string;
  value: string;
  hint?: string;
  footer?: ReactNode;
};

export function MetricTile({ label, value, hint, footer }: MetricTileProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  );
}
