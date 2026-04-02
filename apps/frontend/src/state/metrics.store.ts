import { create } from "zustand";
import type { MetricsResponseV1 } from "@/contracts/MetricsResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { metricsApi } from "@/services/api/metrics.api";

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
    const result = await metricsApi();
    set({
      data: result.data,
      error: result.error,
      loading: false,
    });
  },
}));
