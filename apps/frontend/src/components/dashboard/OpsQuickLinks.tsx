import { Link } from "react-router-dom";
import { Activity, GitBranch, Shield, ScrollText } from "lucide-react";

const links = [
  {
    to: "/app/trace",
    title: "Trace explorer",
    description: "Stage counts, P0 rules, replay & determinism checks.",
    icon: GitBranch,
  },
  {
    to: "/app/system/reliability",
    title: "Reliability",
    description: "Fallback rate, relaxation, canonical hashes.",
    icon: Shield,
  },
  {
    to: "/app/system/metrics",
    title: "Metrics",
    description: "Latency, confidence, and engine counters.",
    icon: Activity,
  },
  {
    to: "/app/system/logs",
    title: "Logs",
    description: "Recent orchestrator events (spot checks).",
    icon: ScrollText,
  },
] as const;

export function OpsQuickLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-indigo-200 hover:ring-indigo-100"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
