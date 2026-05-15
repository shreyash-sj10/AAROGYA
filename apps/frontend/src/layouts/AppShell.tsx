import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, GitBranch, Activity, BookOpen, UserCircle } from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { LeftContextPanel } from "@/components/layout/LeftContextPanel";
import { RightInsightsPanel } from "@/components/layout/RightInsightsPanel";
import { clearAuthToken } from "@/services/auth/auth.api";
import { usePlanStore } from "@/store/plan.store";
import { useUserContextStore } from "@/store/userContext.store";

type AppShellLayoutProps = {
  children: React.ReactNode;
};

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const navigate = useNavigate();
  const clearPlannerState = usePlanStore((s) => s.clearPlannerState);
  const resetUserContext = useUserContextStore((s) => s.resetUserContext);

  const handleLogout = () => {
    clearAuthToken();
    resetUserContext();
    clearPlannerState();
    navigate("/app/login", { replace: true });
  };

  const shellItems = useMemo(
    () => [
      { key: "dashboard", label: "Home", icon: LayoutDashboard, path: "/app/dashboard" },
      { key: "planner", label: "Planner", icon: Calendar, path: "/app/planner" },
      { key: "trace", label: "Trace", icon: GitBranch, path: "/app/trace" },
      { key: "insights", label: "Ops", icon: Activity, path: "/app/system/metrics" },
      { key: "knowledge", label: "Q&A", icon: BookOpen, path: "/app/knowledge" },
      { key: "prakriti", label: "Profile", icon: UserCircle, path: "/app/onboarding" },
    ],
    [],
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[color:var(--plan-bg)] text-[color:var(--plan-text)]">
      <TopNavbar onLogout={handleLogout} />
      <MobileNav items={shellItems} />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:gap-3 md:p-3 lg:gap-4 lg:p-4">
        <Sidebar items={shellItems} />
        <LeftContextPanel />
        <main className="app-shell-main plan-panel !rounded-xl md:!rounded-2xl">{children}</main>
        <RightInsightsPanel />
      </div>
    </div>
  );
}
