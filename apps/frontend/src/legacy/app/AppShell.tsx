import { LayoutDashboard, Activity, HeartPulse, GitBranch, ClipboardList } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/system/builder", label: "Plan Builder", icon: ClipboardList },
  { to: "/system/result", label: "Plan Result", icon: LayoutDashboard },
  { to: "/system/trace", label: "Trace", icon: GitBranch },
  { to: "/system/health", label: "Health", icon: HeartPulse },
  { to: "/system/metrics", label: "Metrics", icon: Activity },
] as const;

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-textPrimary">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-border bg-surface p-4 lg:border-b-0 lg:border-r">
          <h1 className="text-xl font-semibold">AAROGYA</h1>
          <p className="mt-1 text-xs text-muted">Deterministic System Console</p>
          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${isActive ? "border-accent text-textPrimary" : "border-border text-textSecondary"}`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="border-b border-border bg-surface px-4 py-3 lg:px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">System Dashboard Foundation</h2>
              <span className="rounded border border-border px-2 py-1 font-mono text-xs text-textSecondary">
                request_id: pending
              </span>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-6">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
