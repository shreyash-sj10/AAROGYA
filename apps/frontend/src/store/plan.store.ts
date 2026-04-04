import { create } from "zustand";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";

type PlanState = {
  plan: DecisionResponseV1 | null;
  loading: boolean;
  error: ErrorResponseV1 | null;
  setPlan: (response: DecisionResponseV1) => void;
  clearPlan: () => void;
  setLoading: (value: boolean) => void;
  setError: (error: ErrorResponseV1 | null) => void;
};

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  loading: false,
  error: null,
  setPlan: (response) => set({ plan: response }),
  clearPlan: () => set({ plan: null, error: null, loading: false }),
  setLoading: (value) => set({ loading: value }),
  setError: (error) => set({ error }),
}));
