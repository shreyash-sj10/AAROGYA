import type { TraceV1 } from "@/contracts/TraceV1";

export type MetricsResponseV1 = {
  version: "MetricsResponse_v1";
  request_id: string;
  trace_id: string;
  trace: TraceV1;
  api_request_count: number;
  api_error_count: number;
  request_count: number;
  avg_latency: number;
  p95_latency: number;
  p99_latency: number;
  avg_pipeline_ms: number;
  avg_optimizer_ms: number;
  avg_candidate_count: number;
  fallback_rate: number;
  totals: {
    pipeline_ms: number;
    optimizer_ms: number;
    candidate_count: number;
    fallback_count: number;
  };
  last_request: {
    latency_ms: number;
    pipeline_ms: number;
    optimizer_ms: number;
    candidate_count: number;
    used_fallback: boolean;
    confidence_level: "low" | "medium" | "high";
  };
  confidence_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  errors: {
    SCHEMA_VALIDATION_FAILED: number;
    OPTIMIZER_FAILURE: number;
    AI_FAILURE: number;
    CACHE_ERROR: number;
    CACHE_PARSE_ERROR: number;
    SYSTEM_ERROR: number;
  };
  ai_metrics: {
    request_count: number;
    response_count: number;
    schema_valid_count: number;
    schema_invalid_count: number;
    fallback_count: number;
    avg_latency_ms: number;
    schema_compliance_rate: number;
    invalid_response_rate: number;
    fallback_rate: number;
    latency_histogram: {
      le_50ms: number;
      le_100ms: number;
      le_250ms: number;
      le_500ms: number;
      le_1000ms: number;
      gt_1000ms: number;
    };
  };
  ai_disagreement: {
    compared_count: number;
    mismatch_count: number;
    mismatch_rate: number;
  };
  meta: {
    latency_ms: number;
    request_id: string;
    trace_id: string;
  };
};
