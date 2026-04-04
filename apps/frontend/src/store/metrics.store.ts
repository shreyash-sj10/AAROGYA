import { create } from "zustand";
import type { MetricsResponseV1 } from "@/contracts/MetricsResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { metricsApi } from "@/services/api/metrics.api";

function buildClientError(err: unknown): ErrorResponseV1 {
  const message = err instanceof Error ? err.message : "Metrics request failed";
  const now = Date.now();
  const traceId = "client_trace_metrics";

  return {
    version: "ErrorResponse_v1",
    request_id: "client_request_metrics",
    trace_id: traceId,
    trace: {
      version: "Trace_v1",
      schema_version: 1,
      compatibility: "backward",
      trace_id: traceId,
      timestamp: now,
      stages: {
        candidate_generator: { input_count: 1, output_count: 0 },
        constraint_engine: { input_count: 1, output_count: 0, rejected: 1, rules: [] },
        scoring_engine: { input_count: 0, output_count: 0 },
        diversity_engine: { input_count: 0, output_count: 0 },
        optimizer: { input_count: 0, output_count: 0, combinations_evaluated: 0, selected_score: 0 },
        reliability_engine: { input_count: 0, output_count: 0 },
      },
    },
    error: {
      code: "CLIENT_STORE_ERROR",
      message,
      details: {
        source: "store.metrics",
      },
    },
  };
}

type MetricsStore = {
  data: MetricsResponseV1 | null;
  loading: boolean;
  error: ErrorResponseV1 | null;
  fetch: () => Promise<void>;
};

export const useMetricsStore = create<MetricsStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await metricsApi();
      set({
        data: result.data,
        error: result.error,
      });
    } catch (err) {
      set({
        error: buildClientError(err),
      });
    } finally {
      set({ loading: false });
    }
  },
}));
