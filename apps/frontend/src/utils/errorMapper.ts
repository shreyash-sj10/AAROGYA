import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";

export function errorMapper(error: unknown): ErrorResponseV1 {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<ErrorResponseV1>;
    if (candidate.version === "v1" && candidate.error && typeof candidate.error.message === "string") {
      return {
        version: "v1",
        error: candidate.error,
      };
    }
  }

  if (error instanceof Error) {
    return {
      version: "v1",
      error: {
        code: "FRONTEND_RUNTIME_ERROR",
        message: error.message,
      },
    };
  }

  return {
    version: "v1",
    error: {
      code: "UNKNOWN_ERROR",
      message: "Unknown error occurred",
    },
  };
}
