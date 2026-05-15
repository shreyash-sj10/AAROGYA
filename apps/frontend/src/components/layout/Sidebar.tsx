import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { PanelLeft } from "lucide-react";

type SidebarItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
};

type SidebarProps = {
  items: SidebarItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentKey = useMemo(() => {
    const matches = items
      .filter((item) => location.pathname.startsWith(item.path))
      .sort((a, b) => b.path.length - a.path.length);
    return matches[0]?.key ?? "";
  }, [items, location.pathname]);

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col overflow-hidden rounded-xl border border-[color:var(--plan-border-strong)] bg-[color:var(--plan-surface)] shadow-sm md:flex ${
        collapsed ? "w-[56px]" : "w-[200px]"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex h-11 items-center gap-2 border-b border-slate-100 px-3 text-slate-600 hover:bg-slate-50"
        aria-label="Toggle sidebar"
      >
        <PanelLeft size={16} />
        {!collapsed ? <span className="text-xs font-medium">Navigation</span> : null}
      </button>

      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => {
          const active = item.key === currentKey;
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.path)}
              title={item.label}
              className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm transition ${
                collapsed ? "justify-center" : "gap-2.5"
              } ${
                active
                  ? "bg-[#fffdf8] font-semibold text-[color:var(--plan-text)] ring-1 ring-[color:var(--plan-accent)]/30"
                  : "text-[color:var(--plan-muted)] hover:bg-[color:var(--plan-bg-soft)] hover:text-[color:var(--plan-text)]"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
