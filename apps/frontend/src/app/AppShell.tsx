import { Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { AppShellLayout } from "@/layouts/AppShell";
import { useAuthInit } from "@/hooks/useAuthInit";

export function AppShell() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { loading } = useAuthInit();

  const isPublicRoute = location.pathname === "/app/login" || location.pathname === "/app/signup" || location.pathname === "/app/onboarding";
  const isProtectedKnownRoute = (location.pathname.startsWith("/app/") && !isPublicRoute) || location.pathname.startsWith("/system");
  const usesShell = isAuthenticated && location.pathname.startsWith("/app/") && !isPublicRoute;

  if (loading && isProtectedKnownRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--eng-bg)]">
        <p className="text-sm text-slate-600">Loading session…</p>
      </div>
    );
  }

  if (!usesShell) {
    return <Outlet />;
  }

  return (
    <AppShellLayout>
      <Outlet />
    </AppShellLayout>
  );
}

