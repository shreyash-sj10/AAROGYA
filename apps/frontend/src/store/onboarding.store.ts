import { create } from "zustand";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { PrakritiEstimateRequest, PrakritiEstimateResponse } from "@/services/api/prakriti.api";

export type OnboardingIdentity = {
  name: string;
  email: string | null;
};

export type OnboardingProfile = {
  age: number | null;
  gender: "male" | "female" | "other" | null;
  height: number | null;
  weight: number | null;
};

export type OnboardingHealth = {
  conditions: string[];
  allergies: string[];
  medications: string[];
};

export type OnboardingSymptoms = {
  text: string;
  extracted_tags: string[];
};

export type OnboardingPrakriti = {
  questionnaire: Partial<PrakritiEstimateRequest["answers"]> | null;
  result: PrakritiEstimateResponse | null;
  loading: boolean;
  error: string | null;
};

export type OnboardingConstraints = {
  user_id: string | null;
  preferences: string[];
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"] | null;
  season: DecisionRequestV1["user_state"]["context"]["season"] | null;
  max_calories: number | null;
  diet_type: DecisionRequestV1["constraints"]["diet_type"] | null;
  request_source: string | null;
  cache_allowed: boolean | null;
};

export type OnboardingRequestMeta = {
  request_id: string | null;
  trace_id: string | null;
  timestamp: number | null;
};

export type SubmitFailure = {
  code: string;
  message: string;
  trace_id?: string;
};

export type OnboardingState = {
  identity: OnboardingIdentity;
  profile: OnboardingProfile;
  health: OnboardingHealth;
  symptoms: OnboardingSymptoms;
  prakriti: OnboardingPrakriti;
  goal: string | null;
  constraints: OnboardingConstraints;
  requestMeta: OnboardingRequestMeta;
  currentStep: number;
  submitting: boolean;
  submitFailure: SubmitFailure | null;
};

type OnboardingActions = {
  setIdentity: (identity: OnboardingIdentity) => void;
  setProfile: (profile: OnboardingProfile) => void;
  setHealth: (health: OnboardingHealth) => void;
  setSymptoms: (symptoms: OnboardingSymptoms) => void;
  setGoal: (goal: string | null) => void;
  setConstraints: (constraints: OnboardingConstraints) => void;
  setPrakritiQuestionnaire: (answers: Partial<PrakritiEstimateRequest["answers"]>) => void;
  setPrakritiResult: (result: PrakritiEstimateResponse) => void;
  setPrakritiLoading: (loading: boolean) => void;
  setPrakritiError: (error: string | null) => void;
  clearPrakritiResult: () => void;
  setRequestMeta: (meta: OnboardingRequestMeta) => void;
  setCurrentStep: (index: number) => void;
  setSubmitting: (submitting: boolean) => void;
  setSubmitFailure: (failure: SubmitFailure | null) => void;
  resetOnboarding: () => void;
};

const initialState: OnboardingState = {
  identity: {
    name: "",
    email: null,
  },
  profile: {
    age: null,
    gender: null,
    height: null,
    weight: null,
  },
  health: {
    conditions: [],
    allergies: [],
    medications: [],
  },
  symptoms: {
    text: "",
    extracted_tags: [],
  },
  prakriti: {
    questionnaire: null,
    result: null,
    loading: false,
    error: null,
  },
  goal: null,
  constraints: {
    user_id: null,
    preferences: [],
    meal_type: null,
    season: null,
    max_calories: null,
    diet_type: null,
    request_source: null,
    cache_allowed: null,
  },
  requestMeta: {
    request_id: null,
    trace_id: null,
    timestamp: null,
  },
  currentStep: 0,
  submitting: false,
  submitFailure: null,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set) => ({
  ...initialState,
  setIdentity: (identity) => set({ identity }),
  setProfile: (profile) => set({ profile }),
  setHealth: (health) => set({ health }),
  setSymptoms: (symptoms) => set({ symptoms }),
  setGoal: (goal) => set({ goal }),
  setConstraints: (constraints) => set({ constraints }),
  setPrakritiQuestionnaire: (answers) => set((state) => ({
    prakriti: {
      ...state.prakriti,
      questionnaire: answers,
    },
  })),
  setPrakritiResult: (result) => set((state) => ({
    prakriti: {
      ...state.prakriti,
      result,
      error: null,
    },
  })),
  setPrakritiLoading: (loading) => set((state) => ({
    prakriti: {
      ...state.prakriti,
      loading,
    },
  })),
  setPrakritiError: (error) => set((state) => ({
    prakriti: {
      ...state.prakriti,
      error,
    },
  })),
  clearPrakritiResult: () => set((state) => ({
    prakriti: {
      ...state.prakriti,
      result: null,
      error: null,
    },
  })),
  setRequestMeta: (requestMeta) => set({ requestMeta }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setSubmitting: (submitting) => set({ submitting }),
  setSubmitFailure: (submitFailure) => set({ submitFailure }),
  resetOnboarding: () => set({ ...initialState }),
}));
