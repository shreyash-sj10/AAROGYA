import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useUserContextStore } from "@/store/userContext.store";
import { usePlanStore } from "@/store/plan.store";
import { StatusPill } from "@/components/ui/StatusPill";

type TopNavbarProps = {
  onLogout: () => void;
};

export function TopNavbar({ onLogout }: TopNavbarProps) {
  const profileName = useUserContextStore((s) => s.userContext.profile.name);
  const plan = usePlanStore((s) => s.plan);
  const displayName = useMemo(
    () => (profileName && profileName.trim() ? profileName.trim() : "Operator"),
    [profileName],
  );

  const traceId = plan?.trace_id;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--plan-border-strong)] bg-[linear-gradient(90deg,#fbf8f2_0%,#f5f1e8_100%)] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link to="/app/dashboard" className="truncate text-sm font-bold tracking-tight text-[color:var(--plan-text)]">
          AAROGYA
          <span className="ml-2 hidden font-normal text-[color:var(--plan-muted)] sm:inline">Wellness console</span>
        </Link>
        <span className="hidden h-4 w-px bg-slate-200 md:block" aria-hidden />
        <p className="hidden truncate text-xs text-slate-500 md:block">
          Deterministic planning · contract-bound assistive layer
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {traceId ? (
          <span className="hidden max-w-[200px] truncate font-mono text-[10px] text-slate-500 lg:inline" title={traceId}>
            trace:{traceId.slice(0, 12)}…
          </span>
        ) : (
          <StatusPill label="No active trace" tone="neutral" />
        )}
        <span className="hidden text-xs text-slate-600 sm:inline">{displayName}</span>
        <button
          type="button"
          onClick={onLogout}
          className="plan-btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
