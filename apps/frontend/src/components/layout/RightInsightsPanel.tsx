import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import { usePlanStore } from "@/store/plan.store";
import { StatusPill } from "@/components/ui/StatusPill";

function toPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function RightInsightsPanel() {
  const userContext = useUserContextStore((s) => s.userContext);
  const plan = usePlanStore((s) => s.plan);

  const hasPlan = Boolean(plan && Array.isArray(plan.meal_plan) && plan.meal_plan.length > 0);
  const confidencePct = hasPlan && plan ? toPercent(plan.confidence.value) : null;

  const trace = plan?.trace as { stages?: { constraint_engine?: { p0_violations?: number } } } | undefined;
  const p0Violations = trace?.stages?.constraint_engine?.p0_violations ?? 0;

  const readiness = useMemo(() => {
    const checks = [Boolean(userContext.prakriti), Boolean(userContext.goals), hasPlan];
    const passed = checks.filter(Boolean).length;
    const pct = Math.round((passed / checks.length) * 100);
    if (pct >= 80) return { pct, tone: "ok" as const, label: "Ready" };
    if (pct >= 50) return { pct, tone: "warn" as const, label: "Partial" };
    return { pct, tone: "neutral" as const, label: "Setup" };
  }, [userContext.prakriti, userContext.goals, hasPlan]);

  const warnings = hasPlan && plan ? plan.warnings.slice(0, 3) : [];

  return (
    <aside className="hidden h-full w-[min(100%,272px)] max-w-[272px] shrink-0 space-y-3 overflow-y-auto xl:block">
      <section className="plan-panel p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Session</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {readiness.pct}% · {readiness.label}
        </p>
        <div className="mt-2">
          <StatusPill
            label={hasPlan ? `Confidence ${confidencePct ?? 0}%` : "No plan"}
            tone={hasPlan ? (confidencePct && confidencePct >= 70 ? "ok" : "warn") : "neutral"}
          />
        </div>
        {hasPlan ? (
          <p className="mt-2 font-mono text-[10px] text-slate-500 truncate" title={plan?.request_id}>
            req:{plan?.request_id?.slice(0, 14)}…
          </p>
        ) : null}
      </section>

      <section className="plan-panel p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--plan-label)]">Safety</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusPill label={`P0 violations: ${p0Violations}`} tone={p0Violations > 0 ? "error" : "ok"} />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {warnings.length > 0
            ? warnings.map((item, idx) => (
                <li key={`${idx}-${item.slice(0, 12)}`} className="line-clamp-2">
                  {item}
                </li>
              ))
            : (
              <li className="text-slate-400">No warnings on latest plan.</li>
            )}
        </ul>
      </section>

      <section className="plan-panel p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--plan-label)]">Deep dive</p>
        <nav className="mt-2 flex flex-col gap-1.5 text-xs">
          <Link to="/app/trace" className="font-medium text-[color:var(--plan-accent)] hover:underline">
            Trace explorer →
          </Link>
          <Link to="/app/system/reliability" className="font-medium text-[color:var(--plan-accent)] hover:underline">
            Reliability & hashes →
          </Link>
          <Link to="/app/system/metrics" className="font-medium text-[color:var(--plan-accent)] hover:underline">
            Metrics overview →
          </Link>
        </nav>
      </section>
    </aside>
  );
}
