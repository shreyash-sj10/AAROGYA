import type { HealthResponseV1 } from "@/contracts/HealthResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { z } from "zod";

const healthResponseSchema = z.object({
  version: z.literal("HealthResponse_v1"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  status: z.enum(["ok", "degraded"]),
  checks: z.object({
    db: z.object({ ok: z.boolean(), error: z.string().optional() }),
    redis: z.object({ ok: z.boolean(), error: z.string().optional() }),
    ai: z.object({ ok: z.boolean(), error: z.string().optional() }),
  }),
  meta: z.object({ latency_ms: z.number().int().nonnegative() }),
});

export async function healthApi(): Promise<ApiResult<HealthResponseV1>> {
  return apiClient<HealthResponseV1>({
    method: "GET",
    path: "/health",
    retry: true,
    responseSchema: healthResponseSchema,
  });
}
