import { create } from "zustand";
import type { HealthResponseV1 } from "@/contracts/HealthResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { healthApi } from "@/services/api/health.api";

function buildClientError(err: unknown): ErrorResponseV1 {
  const message = err instanceof Error ? err.message : "Health request failed";
  const now = Date.now();
  const traceId = "client_trace_health";

  return {
    version: "ErrorResponse_v1",
    request_id: "client_request_health",
    trace_id: traceId,
    trace: {
      version: "Trace_v1",
      schema_version: 1,
      compatibility: "backward",
      trace_id: traceId,
      timestamp: now,
      stages: {
        interpretation_layer: {
          ml_used: false,
          ml_confidence: 0,
          ml_contribution_weight: 0,
        },
        candidate_generator: { input_count: 1, output_count: 0 },
        constraint_engine: {
          input_count: 1,
          output_count: 0,
          rejected: 1,
          rules: [],
          p0_rules_checked: 0,
          p0_violations: 0,
          p0_violated_rule_ids: [],
        },
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
        source: "store.health",
      },
    },
  };
}

type HealthStore = {
  data: HealthResponseV1 | null;
  loading: boolean;
  error: ErrorResponseV1 | null;
  fetch: () => Promise<void>;
};

export const useHealthStore = create<HealthStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await healthApi();
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
