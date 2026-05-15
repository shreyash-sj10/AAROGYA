export type PlanWeeklyRequestV1 = {
  user_context: {
    user_id: string;
    goals?: string[];
    goal?: string;
    risk_flags?: string[];
    symptoms?: string[];
    dosha_estimate?: {
      vata: number;
      pitta: number;
      kapha: number;
    };
    allergies?: string[];
    preferences?: string[];
    diet_type?: string;
    target_calories?: number;
    context?: {
      season?: "summer" | "winter" | "monsoon";
    };
  };
  constraints?: {
    max_calories?: number;
    diet_type?: "vegetarian" | "vegan";
    season?: "summer" | "winter" | "monsoon";
  };
  preferences?: {
    liked_foods?: string[];
    disliked_foods?: string[];
    interaction_logs?: Array<Record<string, unknown>>;
  };
  days?: number;
};
