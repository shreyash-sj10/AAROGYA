import type { MetricsResponseV1 } from "@/contracts/MetricsResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { z } from "zod";

const metricsResponseSchema = z.object({
  version: z.literal("MetricsResponse_v1"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  request_count: z.number().int().nonnegative(),
  avg_latency: z.number().nonnegative(),
  p95_latency: z.number().nonnegative(),
  fallback_rate: z.number().min(0).max(1),
  meta: z.object({ latency_ms: z.number().int().nonnegative() }),
}).passthrough();

export async function metricsApi(): Promise<ApiResult<MetricsResponseV1>> {
  return apiClient<MetricsResponseV1>({
    method: "GET",
    path: "/metrics",
    retry: true,
    responseSchema: metricsResponseSchema,
  });
}
