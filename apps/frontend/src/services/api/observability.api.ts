import { z } from "zod";
import { apiClient, type ApiResult } from "@/services/api/apiClient";

export type SystemMetricsLite = {
  totalPlansGenerated: number | null;
  averageLatency: number | null;
  successRate: number | null;
  averageConfidence: number | null;
  /** Engine / API-layer fallback rate (0–100 when known). */
  engineFallbackRatePercent: number | null;
  /** Assistive AI layer fallback rate (0–100). */
  aiLayerFallbackRatePercent: number | null;
  lastUsedFallback: boolean | null;
  avgPipelineMs: number | null;
  avgOptimizerMs: number | null;
  aiSchemaCompliancePercent: number | null;
  aiInvalidResponsePercent: number | null;
  optimizerFailureCount: number | null;
  schemaValidationFailedCount: number | null;
  /** Phase 3: share of plans with P0 violation flags in trace (0–100). */
  p0TraceFlagPercent: number | null;
  avgRelaxationLevel: number | null;
};

export type SystemLogEntry = {
  timestamp: string;
  actionType: string;
  metadata: Record<string, unknown>;
};

export type TrendPoint = {
  timestamp: number;
  value: number;
};

export type AdherenceHistoryEntry = {
  week_id: string;
  adherence_score: number;
  stats: {
    meals_followed?: number;
    meals_skipped?: number;
    meals_modified?: number;
  };
};

export type DashboardTelemetry = {
  user_id: string;
  generated_at: number;
  fallback_rate: number;
  score_trend: TrendPoint[];
  confidence_trend: TrendPoint[];
  fallback_rate_trend: TrendPoint[];
  adherence_history: AdherenceHistoryEntry[];
};

const unknownSchema = z.unknown();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asPercent(value: unknown): number | null {
  const num = asNumber(value);
  if (num === null) {
    return null;
  }

  if (num >= 0 && num <= 1) {
    return num * 100;
  }

  if (num >= 0 && num <= 100) {
    return num;
  }

  return null;
}

function normalizeMetrics(payload: unknown): SystemMetricsLite {
  const root = asRecord(payload);
  const confidenceDistribution = asRecord(root.confidence_distribution);
  const requestCount = asNumber(root.request_count) ?? 0;
  const low = asNumber(confidenceDistribution.low) ?? 0;
  const medium = asNumber(confidenceDistribution.medium) ?? 0;
  const high = asNumber(confidenceDistribution.high) ?? 0;
  const weightedConfidence = requestCount > 0
    ? (((low * 0.3) + (medium * 0.6) + (high * 0.9)) / requestCount) * 100
    : null;

  const apiErrorCount = asNumber(root.api_error_count) ?? 0;
  const successRate = requestCount > 0
    ? Math.max(0, Math.min(100, ((requestCount - apiErrorCount) / requestCount) * 100))
    : null;

  const lastRequest = asRecord(root.last_request);
  const errors = asRecord(root.errors);
  const aiMetrics = asRecord(root.ai_metrics);
  const engineHealth = asRecord(root.engine_health);

  const engineFb = asNumber(root.fallback_rate);
  const aiFb = asNumber(aiMetrics.fallback_rate);

  return {
    totalPlansGenerated:
      asNumber(root.total_plans_generated)
      ?? asNumber(root.totalPlansGenerated)
      ?? asNumber(root.request_count),
    averageLatency:
      asNumber(root.average_latency)
      ?? asNumber(root.avg_latency)
      ?? asNumber(root.avgLatency),
    successRate,
    averageConfidence:
      asPercent(root.average_confidence)
      ?? asPercent(root.avg_confidence)
      ?? asPercent(root.averageConfidence)
      ?? weightedConfidence,
    engineFallbackRatePercent: engineFb !== null ? asPercent(engineFb) : null,
    aiLayerFallbackRatePercent: aiFb !== null ? asPercent(aiFb) : null,
    lastUsedFallback: typeof lastRequest.used_fallback === "boolean" ? lastRequest.used_fallback : null,
    avgPipelineMs: asNumber(root.avg_pipeline_ms),
    avgOptimizerMs: asNumber(root.avg_optimizer_ms),
    aiSchemaCompliancePercent: asPercent(aiMetrics.schema_compliance_rate),
    aiInvalidResponsePercent: asPercent(aiMetrics.invalid_response_rate),
    optimizerFailureCount: asNumber(errors.OPTIMIZER_FAILURE),
    schemaValidationFailedCount: asNumber(errors.SCHEMA_VALIDATION_FAILED),
    p0TraceFlagPercent: asPercent(engineHealth.p0_trace_flag_rate),
    avgRelaxationLevel: asNumber(engineHealth.avg_relaxation_level),
  };
}

function normalizeLogs(payload: unknown): SystemLogEntry[] {
  const root = asRecord(payload);
  const rawList = Array.isArray(root.logs)
    ? root.logs
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(payload)
        ? payload
        : [];

  return rawList
    .map((entry) => {
      const item = asRecord(entry);
      const timestamp =
        asString(item.timestamp)
        ?? asString(item.time)
        ?? asString(item.created_at)
        ?? null;
      const actionType =
        asString(item.action_type)
        ?? asString(item.action)
        ?? asString(item.event)
        ?? null;
      const metadata = asRecord(item.metadata ?? item.meta ?? {});

      if (!timestamp || !actionType) {
        return null;
      }

      return {
        timestamp,
        actionType,
        metadata,
      };
    })
    .filter((item): item is SystemLogEntry => item !== null);
}

function normalizeTrend(value: unknown): TrendPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const item = asRecord(entry);
      const timestamp = asNumber(item.timestamp);
      const point = asNumber(item.value);
      if (timestamp === null || point === null) {
        return null;
      }
      return {
        timestamp,
        value: point,
      };
    })
    .filter((entry): entry is TrendPoint => entry !== null);
}

function normalizeAdherenceHistory(value: unknown): AdherenceHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const item = asRecord(entry);
      const weekId = asString(item.week_id);
      const adherenceScore = asNumber(item.adherence_score);
      if (!weekId || adherenceScore === null) {
        return null;
      }
      return {
        week_id: weekId,
        adherence_score: adherenceScore,
        stats: asRecord(item.stats),
      };
    })
    .filter((entry): entry is AdherenceHistoryEntry => entry !== null);
}

export async function systemMetricsApi(): Promise<ApiResult<SystemMetricsLite>> {
  const result = await apiClient<unknown>({
    method: "GET",
    path: "/metrics",
    retry: true,
    responseSchema: unknownSchema,
  });

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
      meta: result.meta,
    };
  }

  return {
    data: normalizeMetrics(result.data),
    error: null,
    meta: result.meta,
  };
}

export async function systemLogsApi(limit = 20): Promise<ApiResult<SystemLogEntry[]>> {
  const result = await apiClient<unknown>({
    method: "GET",
    path: `/logs?limit=${encodeURIComponent(String(limit))}`,
    retry: true,
    responseSchema: unknownSchema,
  });

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
      meta: result.meta,
    };
  }

  return {
    data: normalizeLogs(result.data),
    error: null,
    meta: result.meta,
  };
}

export async function dashboardTelemetryApi(params: {
  user_id: string;
  trend_limit?: number;
}): Promise<ApiResult<DashboardTelemetry>> {
  const trendLimit = Math.max(3, Math.min(20, params.trend_limit ?? 5));
  const result = await apiClient<unknown>({
    method: "GET",
    path: `/dashboard/telemetry?user_id=${encodeURIComponent(params.user_id)}&trend_limit=${trendLimit}`,
    retry: true,
    responseSchema: unknownSchema,
  });

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
      meta: result.meta,
    };
  }

  const root = asRecord(result.data);
  const userId = asString(root.user_id) ?? params.user_id;
  const generatedAt = asNumber(root.generated_at) ?? Date.now();
  const fallbackRate = asNumber(root.fallback_rate) ?? 0;

  return {
    data: {
      user_id: userId,
      generated_at: generatedAt,
      fallback_rate: fallbackRate,
      score_trend: normalizeTrend(root.score_trend),
      confidence_trend: normalizeTrend(root.confidence_trend),
      fallback_rate_trend: normalizeTrend(root.fallback_rate_trend),
      adherence_history: normalizeAdherenceHistory(root.adherence_history),
    },
    error: null,
    meta: result.meta,
  };
}
