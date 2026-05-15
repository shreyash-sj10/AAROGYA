import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { PlanWeeklyResponseV1 } from "@/contracts/PlanWeeklyResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";

export type PlannerPlanType = "single_meal" | "full_day" | "weekly";
export type PlannerMealPreference = "light" | "balanced" | "high_energy";

export type PlannerInputs = {
  plan_type: PlannerPlanType;
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"] | null;
  season: DecisionRequestV1["user_state"]["context"]["season"];
  diet_type: DecisionRequestV1["constraints"]["diet_type"] | null;
  calorie_limit: number | null;
  exclusions: string[];
  preferences: string[];
  meal_preference: PlannerMealPreference | null;
};

export type PlanHistoryEntry = {
  id: string;
  created_at: string;
  plan_type: PlannerPlanType;
  summary: string;
  score_avg: number;
  confidence_avg: number;
};

type PlanState = {
  plan: DecisionResponseV1 | null;
  dailyPlan: DailyResponseV1 | null;
  weeklyPlan: PlanWeeklyResponseV1 | null;
  /** Last `/plan` DecisionRequest (for trace + determinism UI). Cleared on daily/weekly. */
  lastDecisionRequest: DecisionRequestV1 | null;
  planHistory: PlanHistoryEntry[];
  plannerInputs: PlannerInputs;
  loading: boolean;
  error: ErrorResponseV1 | null;
  setPlan: (response: DecisionResponseV1, lastRequest?: DecisionRequestV1 | null) => void;
  setDailyPlan: (response: DailyResponseV1) => void;
  setWeeklyPlan: (response: PlanWeeklyResponseV1) => void;
  setPlannerInputs: (inputs: Partial<PlannerInputs>) => void;
  clearPlan: () => void;
  clearPlannerState: () => void;
  resetPlannerInputs: () => void;
  setLoading: (value: boolean) => void;
  setError: (error: ErrorResponseV1 | null) => void;
};

const DEFAULT_PLANNER_INPUTS: PlannerInputs = {
  plan_type: "single_meal",
  meal_type: null,
  season: "summer",
  diet_type: null,
  calorie_limit: null,
  exclusions: [],
  preferences: [],
  meal_preference: "balanced",
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function makeSingleHistoryEntry(response: DecisionResponseV1): PlanHistoryEntry {
  const meal = response?.meal_plan?.[0];
  const safeScore = Number.isFinite(response?.score) ? response.score : 0;
  const safeConfidence = Number.isFinite(response?.confidence?.value)
    ? response.confidence.value
    : 0;

  return {
    id: response.request_id,
    created_at: toIsoNow(),
    plan_type: "single_meal",
    summary: meal?.name || "Single meal",
    score_avg: Number(clamp01(safeScore).toFixed(6)),
    confidence_avg: Number(clamp01(safeConfidence).toFixed(6)),
  };
}

function makeDailyHistoryEntry(response: DailyResponseV1): PlanHistoryEntry {
  const breakfast = response?.meals?.breakfast?.meal_plan?.[0]?.name || "Breakfast";
  const lunch = response?.meals?.lunch?.meal_plan?.[0]?.name || "Lunch";
  const dinner = response?.meals?.dinner?.meal_plan?.[0]?.name || "Dinner";

  return {
    id: `${response?.meals?.breakfast?.request_id ?? "breakfast"}::${response?.meals?.lunch?.request_id ?? "lunch"}::${response?.meals?.dinner?.request_id ?? "dinner"}`,
    created_at: toIsoNow(),
    plan_type: "full_day",
    summary: `${breakfast} | ${lunch} | ${dinner}`,
    score_avg: Number(clamp01(response?.meta?.score_avg ?? 0).toFixed(6)),
    confidence_avg: Number(clamp01(response?.meta?.confidence_avg ?? 0).toFixed(6)),
  };
}

function makeWeeklyHistoryEntry(response: PlanWeeklyResponseV1): PlanHistoryEntry {
  const dayCount = Array.isArray(response?.weekly_plan) ? response.weekly_plan.length : 0;
  const sampleMeals = (response?.weekly_plan || [])
    .slice(0, 2)
    .flatMap((d) => (d?.meal_plan || []).map((m) => m?.name || ""))
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const scoreAvg = dayCount > 0
    ? response.weekly_plan.reduce((sum, day) => sum + clamp01(day?.score ?? 0), 0) / dayCount
    : 0;
  const confidenceAvg = dayCount > 0
    ? response.weekly_plan.reduce((sum, day) => sum + clamp01(day?.confidence ?? 0), 0) / dayCount
    : 0;

  return {
    id: `weekly::${toIsoNow()}`,
    created_at: toIsoNow(),
    plan_type: "weekly",
    summary: sampleMeals || `Weekly plan (${dayCount} days)`,
    score_avg: Number(clamp01(scoreAvg).toFixed(6)),
    confidence_avg: Number(clamp01(confidenceAvg).toFixed(6)),
  };
}
function pushHistory(history: PlanHistoryEntry[], entry: PlanHistoryEntry): PlanHistoryEntry[] {
  return [entry, ...history].slice(0, 20);
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: null,
      dailyPlan: null,
      weeklyPlan: null,
      lastDecisionRequest: null,
      planHistory: [],
      plannerInputs: DEFAULT_PLANNER_INPUTS,
      loading: false,
      error: null,
      setPlan: (response, lastRequest) => set((state) => ({
        plan: response,
        dailyPlan: null,
        weeklyPlan: null,
        lastDecisionRequest: lastRequest === undefined ? state.lastDecisionRequest : lastRequest,
        planHistory: pushHistory(state.planHistory, makeSingleHistoryEntry(response)),
      })),
      setDailyPlan: (response) => set((state) => ({
        dailyPlan: response,
        plan: null,
        weeklyPlan: null,
        lastDecisionRequest: null,
        planHistory: pushHistory(state.planHistory, makeDailyHistoryEntry(response)),
      })),
      setWeeklyPlan: (response) => set((state) => ({
        weeklyPlan: response,
        plan: null,
        dailyPlan: null,
        lastDecisionRequest: null,
        planHistory: pushHistory(state.planHistory, makeWeeklyHistoryEntry(response)),
      })),
      setPlannerInputs: (inputs) => set((state) => ({
        plannerInputs: {
          ...state.plannerInputs,
          ...inputs,
        },
      })),
      clearPlan: () => set({ plan: null, dailyPlan: null, weeklyPlan: null, lastDecisionRequest: null, error: null, loading: false }),
      clearPlannerState: () => set({
        plan: null,
        dailyPlan: null,
        weeklyPlan: null,
        lastDecisionRequest: null,
        planHistory: [],
        plannerInputs: DEFAULT_PLANNER_INPUTS,
        error: null,
        loading: false,
      }),
      resetPlannerInputs: () => set({ plannerInputs: DEFAULT_PLANNER_INPUTS }),
      setLoading: (value) => set({ loading: value }),
      setError: (error) => set({ error }),
    }),
    {
      name: "aarogya-planner-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        plan: state.plan,
        dailyPlan: state.dailyPlan,
        weeklyPlan: state.weeklyPlan,
        lastDecisionRequest: state.lastDecisionRequest,
        planHistory: state.planHistory,
        plannerInputs: state.plannerInputs,
      }),
      version: 5,
      migrate: (persistedState) => {
        const safe = (persistedState ?? {}) as Partial<PlanState>;
        return {
          ...safe,
          weeklyPlan: safe.weeklyPlan ?? null,
          lastDecisionRequest: safe.lastDecisionRequest ?? null,
          planHistory: Array.isArray(safe.planHistory) ? safe.planHistory : [],
        };
      },
    },
  ),
);



