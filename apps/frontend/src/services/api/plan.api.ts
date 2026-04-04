import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { decisionResponseSchema } from "@/validators/response.validator";
import { decisionRequestSchema } from "@/validators/request.validator";

export async function planApi(request: DecisionRequestV1): Promise<ApiResult<DecisionResponseV1>> {
  return apiClient<DecisionResponseV1>({
    method: "POST",
    path: "/plan",
    body: request,
    requestSchema: decisionRequestSchema,
    responseSchema: decisionResponseSchema,
  });
}
