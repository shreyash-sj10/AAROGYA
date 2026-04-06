import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { ProtectedRoute } from "@/app/routes/ProtectedRoute";
import { PublicRoute } from "@/app/routes/PublicRoute";
import { SystemRootPage } from "@/system/SystemRootPage";
import { SystemMetricsPage } from "@/system/SystemMetricsPage";
import { SystemLogsPage } from "@/system/SystemLogsPage";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";
import OnboardingPage from "@/app/onboarding/page";
import DashboardPage from "@/app/dashboard/page";
import PlannerPage from "@/app/planner/page";
import TracePage from "@/app/trace/page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/login" replace /> },
      {
        path: "/app/login",
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
      {
        path: "/app/signup",
        element: (
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        ),
      },
      {
        path: "/app/onboarding",
        element: (
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/dashboard",
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/planner",
        element: (
          <ProtectedRoute>
            <PlannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/planner/result",
        element: (
          <ProtectedRoute>
            <PlannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/trace",
        element: (
          <ProtectedRoute>
            <TracePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/system",
        element: (
          <ProtectedRoute>
            <SystemRootPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/system/metrics",
        element: (
          <ProtectedRoute>
            <SystemMetricsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app/system/logs",
        element: (
          <ProtectedRoute>
            <SystemLogsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/system",
        element: (
          <ProtectedRoute>
            <SystemRootPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/system/metrics",
        element: (
          <ProtectedRoute>
            <SystemMetricsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/system/logs",
        element: (
          <ProtectedRoute>
            <SystemLogsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
