import type { ZodTypeAny } from "zod";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { parseErrorResponseOrThrow, UnknownContractError } from "@/utils/errorMapper";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class ContractValidationError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ContractValidationError";
    this.details = details;
  }
}

export type ApiRequestOptions = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  requestSchema?: ZodTypeAny;
  responseSchema?: ZodTypeAny;
  non2xxResponseSchemas?: Record<number, ZodTypeAny>;
  requestId?: string;
  traceId?: string;
  timeoutMs?: number;
  retry?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
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

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

function shouldRetry(method: HttpMethod, retry?: boolean): boolean {
  return method === "GET" && retry === true;
}

function resolveIdentity(options: ApiRequestOptions, requestBody: unknown) {
  const safeBody = requestBody && typeof requestBody === "object" && !Array.isArray(requestBody)
    ? requestBody as Record<string, unknown>
    : {};

  const requestIdFromBody = typeof safeBody.request_id === "string" ? safeBody.request_id : undefined;
  const traceIdFromBody = typeof safeBody.trace_id === "string" ? safeBody.trace_id : undefined;

  return {
    requestId: options.requestId || requestIdFromBody,
    traceId: options.traceId || traceIdFromBody,
  };
}

export async function apiClient<T>(options: ApiRequestOptions): Promise<ApiResult<T>> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 8000;

  const execute = async (): Promise<ApiResult<T>> => {
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let removeExternalAbortListener: (() => void) | null = null;

    try {
      const validatedRequestBody = (() => {
        if (!options.requestSchema) {
          return options.body;
        }

        const parsed = options.requestSchema.safeParse(options.body);
        if (!parsed.success) {
          throw new ContractValidationError("Request contract validation failed", {
            path: options.path,
            issues: parsed.error.issues,
            payload: options.body,
          });
        }

        return parsed.data;
      })();

      const identity = resolveIdentity(options, validatedRequestBody);

      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          const onExternalAbort = () => controller.abort();
          options.signal.addEventListener("abort", onExternalAbort, { once: true });
          removeExternalAbortListener = () => {
            options.signal?.removeEventListener("abort", onExternalAbort);
          };
        }
      }

      const response = await fetch(`${BASE_URL}${options.path}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...(identity.requestId ? { "x-request-id": identity.requestId } : {}),
          ...(identity.traceId ? { "x-trace-id": identity.traceId } : {}),
          ...(options.headers || {}),
        },
        body: validatedRequestBody ? JSON.stringify(validatedRequestBody) : undefined,
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        const non2xxSchema = options.non2xxResponseSchemas?.[response.status];
        if (non2xxSchema) {
          const validated = non2xxSchema.safeParse(payload);
          if (!validated.success) {
            throw new ContractValidationError("Non-2xx response contract validation failed", {
              path: options.path,
              status: response.status,
              issues: validated.error.issues,
              payload,
            });
          }

          const validatedData = validated.data as T & { request_id?: string; trace_id?: string };
          return {
            data: validated.data as T,
            error: null,
            meta: {
              status: response.status,
              durationMs,
              requestId: validatedData.request_id || identity.requestId,
              traceId: validatedData.trace_id || identity.traceId,
            },
          };
        }

        const errorResponse = parseErrorResponseOrThrow(payload);
        return {
          data: null,
          error: errorResponse,
          meta: {
            status: response.status,
            durationMs,
            requestId: errorResponse.request_id,
            traceId: errorResponse.trace_id,
          },
        };
      }

      if (options.responseSchema) {
        const validated = options.responseSchema.safeParse(payload);
        if (!validated.success) {
          throw new ContractValidationError("Response contract validation failed", {
            path: options.path,
            issues: validated.error.issues,
            payload,
          });
        }

        return {
          data: validated.data as T,
          error: null,
          meta: {
            status: response.status,
            durationMs,
            requestId: identity.requestId,
            traceId: identity.traceId,
          },
        };
      }

      throw new ContractValidationError("Response contract schema missing", {
        path: options.path,
      });
    } catch (error) {
      if (error instanceof UnknownContractError || error instanceof ContractValidationError) {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      removeExternalAbortListener?.();
    }
  };

  const first = await execute();
  if (!first.error || !shouldRetry(options.method, options.retry)) {
    return first;
  }

  return execute();
}
