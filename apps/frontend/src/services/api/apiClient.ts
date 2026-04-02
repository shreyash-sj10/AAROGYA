import type { ZodTypeAny } from "zod";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { errorMapper } from "@/utils/errorMapper";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiRequestOptions = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  requestId?: string;
  traceId?: string;
  timeoutMs?: number;
  retry?: boolean;
  responseSchema?: ZodTypeAny;
};

export type ApiResult<T> = {
  data: T | null;
  error: ErrorResponseV1 | null;
  meta?: {
    status: number;
    durationMs: number;
    requestId?: string;
    traceId?: string;
  };
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function shouldRetry(method: HttpMethod, retry?: boolean): boolean {
  return method === "GET" && retry === true;
}

export async function apiClient<T>(options: ApiRequestOptions): Promise<ApiResult<T>> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 8000;

  const execute = async (): Promise<ApiResult<T>> => {
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${BASE_URL}${options.path}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...(options.requestId ? { "x-request-id": options.requestId } : {}),
          ...(options.traceId ? { "x-trace-id": options.traceId } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          data: null,
          error: errorMapper(payload),
          meta: {
            status: response.status,
            durationMs,
            requestId: options.requestId,
            traceId: options.traceId,
          },
        };
      }

      if (options.responseSchema) {
        const validated = options.responseSchema.safeParse(payload);
        if (!validated.success) {
          return {
            data: null,
            error: {
              version: "v1",
              error: {
                code: "RESPONSE_VALIDATION_ERROR",
                message: "Response validation failed",
                details: {
                  issues: validated.error.issues,
                },
              },
            },
            meta: {
              status: response.status,
              durationMs,
              requestId: options.requestId,
              traceId: options.traceId,
            },
          };
        }

        return {
          data: validated.data as T,
          error: null,
          meta: {
            status: response.status,
            durationMs,
            requestId: options.requestId,
            traceId: options.traceId,
          },
        };
      }

      return {
        data: payload as T,
        error: null,
        meta: {
          status: response.status,
          durationMs,
          requestId: options.requestId,
          traceId: options.traceId,
        },
      };
    } catch (error) {
      return {
        data: null,
        error: errorMapper(error),
        meta: {
          status: 0,
          durationMs: Date.now() - startedAt,
          requestId: options.requestId,
          traceId: options.traceId,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const first = await execute();
  if (!first.error || !shouldRetry(options.method, options.retry)) {
    return first;
  }

  return execute();
}
