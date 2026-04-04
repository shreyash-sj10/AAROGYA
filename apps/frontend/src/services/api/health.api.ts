import type { HealthResponseV1 } from "@/contracts/HealthResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { healthResponseSchema } from "@/validators/health.validator";

export async function healthApi(): Promise<ApiResult<HealthResponseV1>> {
  return apiClient<HealthResponseV1>({
    method: "GET",
    path: "/health",
    retry: true,
    responseSchema: healthResponseSchema,
    non2xxResponseSchemas: {
      503: healthResponseSchema,
    },
  });
}
