import { create } from "zustand";

export type UserContext = {
  profile: {
    name: string;
    age: number | null;
    gender: "male" | "female" | "other" | null;
    activity_level: string | null;
  };
  health: {
    conditions: string[];
    allergies: string[];
    dietary_restrictions: string[];
  };
  symptoms: {
    text: string;
    extracted_tags: string[];
  };
  goals: string | null;
  constraints: {
    diet_type: string | null;
    calorie_limit: number | null;
    exclusions: string[];
  };
};

type UserContextState = {
  userContext: UserContext;
  setUserContext: (context: UserContext) => void;
  setProfile: (profile: UserContext["profile"]) => void;
  setHealth: (health: UserContext["health"]) => void;
  setSymptoms: (symptoms: UserContext["symptoms"]) => void;
  setGoals: (goals: UserContext["goals"]) => void;
  setConstraints: (constraints: UserContext["constraints"]) => void;
  resetUserContext: () => void;
};

export const initialUserContext: UserContext = {
  profile: {
    name: "",
    age: null,
    gender: null,
    activity_level: null,
  },
  health: {
    conditions: [],
    allergies: [],
    dietary_restrictions: [],
  },
  symptoms: {
    text: "",
    extracted_tags: [],
  },
  goals: null,
  constraints: {
    diet_type: null,
    calorie_limit: null,
    exclusions: [],
  },
};

export const useUserContextStore = create<UserContextState>((set) => ({
  userContext: initialUserContext,
  setUserContext: (userContext) => set({ userContext }),
  setProfile: (profile) => set((state) => ({
    userContext: {
      ...state.userContext,
      profile,
    },
  })),
  setHealth: (health) => set((state) => ({
    userContext: {
      ...state.userContext,
      health,
    },
  })),
  setSymptoms: (symptoms) => set((state) => ({
    userContext: {
      ...state.userContext,
      symptoms,
    },
  })),
  setGoals: (goals) => set((state) => ({
    userContext: {
      ...state.userContext,
      goals,
    },
  })),
  setConstraints: (constraints) => set((state) => ({
    userContext: {
      ...state.userContext,
      constraints,
    },
  })),
  resetUserContext: () => set({ userContext: initialUserContext }),
}));
