export type MetricsResponseV1 = {
  version: "MetricsResponse_v1";
  request_id: string;
  trace_id: string;
  request_count: number;
  avg_latency: number;
  p95_latency: number;
  fallback_rate: number;
  meta: { latency_ms: number };
  [key: string]: unknown;
};
