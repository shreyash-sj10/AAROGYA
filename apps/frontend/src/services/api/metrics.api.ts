import type { MetricsResponseV1 } from "@/contracts/MetricsResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { metricsResponseSchema } from "@/validators/metrics.validator";

export async function metricsApi(): Promise<ApiResult<MetricsResponseV1>> {
  return apiClient<MetricsResponseV1>({
    method: "GET",
    path: "/metrics",
    retry: true,
    responseSchema: metricsResponseSchema,
  });
}
