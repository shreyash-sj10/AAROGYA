import { create } from "zustand";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import { createInitialDecisionRequest } from "@/utils/ids";
import { planApi } from "@/services/api/plan.api";

type PlanStore = {
  data: DecisionResponseV1 | null;
  loading: boolean;
  error: ErrorResponseV1 | null;
  requestDraft: DecisionRequestV1;
  setRequestDraft: (payload: DecisionRequestV1) => void;
  setPlanState: (payload: DecisionResponseV1 | null) => void;
  runPlan: () => Promise<void>;
  reset: () => void;
};

export const usePlanStore = create<PlanStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  requestDraft: createInitialDecisionRequest(),
  setRequestDraft: (payload) => set({ requestDraft: payload }),
  setPlanState: (payload) => set({ data: payload, error: null, loading: false }),
  runPlan: async () => {
    if (get().loading) {
      return;
    }

    set({ loading: true, error: null });
    const result = await planApi(get().requestDraft);
    set({
      data: result.data,
      error: result.error,
      loading: false,
    });
  },
  reset: () => set({ data: null, error: null, loading: false, requestDraft: createInitialDecisionRequest() }),
}));
