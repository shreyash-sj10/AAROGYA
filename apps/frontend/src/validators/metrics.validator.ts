import { z } from "zod";
import { traceSchema } from "@/validators/trace.validator";

const nonNegativeInt = z.number().int().nonnegative();
const nonNegativeNumber = z.number().nonnegative();

export const metricsResponseSchema = z.object({
  version: z.literal("MetricsResponse_v1"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  trace: traceSchema,
  api_request_count: nonNegativeInt,
  api_error_count: nonNegativeInt,
  request_count: nonNegativeInt,
  avg_latency: nonNegativeNumber,
  p95_latency: nonNegativeNumber,
  p99_latency: nonNegativeNumber,
  avg_pipeline_ms: nonNegativeNumber,
  avg_optimizer_ms: nonNegativeNumber,
  avg_candidate_count: nonNegativeNumber,
  fallback_rate: z.number().min(0).max(1),
  totals: z.object({
    pipeline_ms: nonNegativeNumber,
    optimizer_ms: nonNegativeNumber,
    candidate_count: nonNegativeInt,
    fallback_count: nonNegativeInt,
  }).strict(),
  last_request: z.object({
    latency_ms: nonNegativeNumber,
    pipeline_ms: nonNegativeNumber,
    optimizer_ms: nonNegativeNumber,
    candidate_count: nonNegativeInt,
    used_fallback: z.boolean(),
    confidence_level: z.enum(["low", "medium", "high"]),
  }).strict(),
  confidence_distribution: z.object({
    low: nonNegativeInt,
    medium: nonNegativeInt,
    high: nonNegativeInt,
  }).strict(),
  errors: z.object({
    SCHEMA_VALIDATION_FAILED: nonNegativeInt,
    OPTIMIZER_FAILURE: nonNegativeInt,
    AI_FAILURE: nonNegativeInt,
    CACHE_ERROR: nonNegativeInt,
    CACHE_PARSE_ERROR: nonNegativeInt,
    SYSTEM_ERROR: nonNegativeInt,
  }).strict(),
  ai_metrics: z.object({
    request_count: nonNegativeInt,
    response_count: nonNegativeInt,
    schema_valid_count: nonNegativeInt,
    schema_invalid_count: nonNegativeInt,
    fallback_count: nonNegativeInt,
    avg_latency_ms: nonNegativeNumber,
    schema_compliance_rate: z.number().min(0).max(1),
    invalid_response_rate: z.number().min(0).max(1),
    fallback_rate: z.number().min(0).max(1),
    latency_histogram: z.object({
      le_50ms: nonNegativeInt,
      le_100ms: nonNegativeInt,
      le_250ms: nonNegativeInt,
      le_500ms: nonNegativeInt,
      le_1000ms: nonNegativeInt,
      gt_1000ms: nonNegativeInt,
    }).strict(),
  }).strict(),
  ai_disagreement: z.object({
    compared_count: nonNegativeInt,
    mismatch_count: nonNegativeInt,
    mismatch_rate: z.number().min(0).max(1),
  }).strict(),
  meta: z.object({
    latency_ms: z.number().int().nonnegative(),
    request_id: z.string().min(1),
    trace_id: z.string().min(1),
  }).strict(),
}).strict();

export type MetricsResponseSchema = z.infer<typeof metricsResponseSchema>;

export function validateMetricsResponse(payload: unknown) {
  return metricsResponseSchema.safeParse(payload);
}
