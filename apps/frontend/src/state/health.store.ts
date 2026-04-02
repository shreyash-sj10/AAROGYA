import { create } from "zustand";
import type { HealthResponseV1 } from "@/contracts/HealthResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { healthApi } from "@/services/api/health.api";

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
    const result = await healthApi();
    set({
      data: result.data,
      error: result.error,
      loading: false,
    });
  },
}));
