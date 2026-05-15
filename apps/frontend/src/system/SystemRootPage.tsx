import { Navigate, useLocation } from "react-router-dom";

export function SystemRootPage() {
  const { pathname } = useLocation();
  const target = pathname.startsWith("/app/") ? "/app/system/metrics" : "/system/metrics";
  return <Navigate to={target} replace />;
}
