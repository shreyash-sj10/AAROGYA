import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { SystemRootPage } from "@/system/SystemRootPage";
import OnboardingPage from "@/app/onboarding/page";
import DashboardPage from "@/app/dashboard/page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/onboarding" replace /> },
      { path: "/system", element: <SystemRootPage /> },
      { path: "/app/onboarding", element: <OnboardingPage /> },
      { path: "/app/dashboard", element: <DashboardPage /> },
    ],
  },
]);
