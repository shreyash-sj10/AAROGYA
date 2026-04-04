import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { validateErrorResponse } from "@/validators/error.validator";

export class UnknownContractError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "UnknownContractError";
    this.details = details;
  }
}

export function parseErrorResponseOrThrow(payload: unknown): ErrorResponseV1 {
  const parsed = validateErrorResponse(payload);
  if (!parsed.success) {
    throw new UnknownContractError("Invalid ErrorResponse_v1 contract", {
      issues: parsed.error.issues,
      payload,
    });
  }

  return parsed.data;
}

