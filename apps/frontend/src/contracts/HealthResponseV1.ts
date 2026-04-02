export type HealthResponseV1 = {
  version: "HealthResponse_v1";
  request_id: string;
  trace_id: string;
  status: "ok" | "degraded";
  checks: {
    db: { ok: boolean; error?: string };
    redis: { ok: boolean; error?: string };
    ai: { ok: boolean; error?: string };
  };
  meta: { latency_ms: number };
};
