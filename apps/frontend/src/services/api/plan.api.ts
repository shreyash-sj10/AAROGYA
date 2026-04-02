import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { decisionResponseSchema } from "@/services/validation/response.validator";
import { validateDecisionRequest } from "@/services/validation/request.validator";

export async function planApi(request: DecisionRequestV1): Promise<ApiResult<DecisionResponseV1>> {
  const requestCheck = validateDecisionRequest(request);
  if (!requestCheck.success) {
    return {
      data: null,
      error: {
        version: "v1",
        error: {
          code: "REQUEST_VALIDATION_ERROR",
          message: "DecisionRequest_v1 validation failed",
          details: {
            issues: requestCheck.error.issues,
          },
        },
      },
      meta: {
        status: 0,
        durationMs: 0,
        requestId: request.request_id,
        traceId: request.trace_id,
      },
    };
  }

  const validatedRequest = requestCheck.data;

  return apiClient<DecisionResponseV1>({
    method: "POST",
    path: "/plan",
    body: validatedRequest,
    requestId: validatedRequest.request_id,
    traceId: validatedRequest.trace_id,
    responseSchema: decisionResponseSchema,
  });
}
