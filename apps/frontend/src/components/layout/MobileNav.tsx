import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

type MobileNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
};

type MobileNavProps = {
  items: MobileNavItem[];
};

export function MobileNav({ items }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentKey = useMemo(() => {
    const matches = items
      .filter((item) => location.pathname.startsWith(item.path))
      .sort((a, b) => b.path.length - a.path.length);
    return matches[0]?.key ?? "";
  }, [items, location.pathname]);

  return (
    <nav
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-[color:var(--plan-border-strong)] bg-[color:var(--plan-bg-soft)] px-2 py-2 md:hidden [-webkit-overflow-scrolling:touch]"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const active = item.key === currentKey;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
              active
                ? "border-[color:var(--plan-accent)] bg-[#fffdf8] text-[color:var(--plan-text)] shadow-sm"
                : "border-[color:var(--plan-border)] bg-white text-[color:var(--plan-muted)]"
            }`}
          >
            <Icon size={14} className="shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
