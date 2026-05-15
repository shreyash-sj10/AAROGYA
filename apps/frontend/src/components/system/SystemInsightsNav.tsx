import { NavLink, useLocation } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition ${
    isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function SystemInsightsNav() {
  const { pathname } = useLocation();
  const base = pathname.startsWith("/app/") ? "/app/system" : "/system";

  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
      <NavLink to={`${base}/metrics`} className={linkClass} end>
        Overview
      </NavLink>
      <NavLink to={`${base}/reliability`} className={linkClass}>
        Reliability & determinism
      </NavLink>
      <NavLink to={`${base}/logs`} className={linkClass}>
        Logs
      </NavLink>
    </nav>
  );
}
