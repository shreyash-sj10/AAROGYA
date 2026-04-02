import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { PlanBuilderPage } from "@/pages/system/builder/PlanBuilderPage";
import { PlanResultPage } from "@/pages/system/result/PlanResultPage";
import { TracePage } from "@/pages/system/trace/TracePage";
import { HealthPage } from "@/pages/system/health/HealthPage";
import { MetricsPage } from "@/pages/system/metrics/MetricsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/system/builder" replace /> },
      { path: "/system/builder", element: <PlanBuilderPage /> },
      { path: "/system/result", element: <PlanResultPage /> },
      { path: "/system/trace", element: <TracePage /> },
      { path: "/system/health", element: <HealthPage /> },
      { path: "/system/metrics", element: <MetricsPage /> },
    ],
  },
]);
