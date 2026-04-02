export type DecisionRequestV1 = {
  version: "DecisionRequest_v1";
  schema_version: 1;
  compatibility: "backward";
  request_id: string;
  trace_id: string;
  user_state: {
    user_id: string;
    goals: string[];
    risk_flags: string[];
    symptoms: string[];
    dosha_estimate: {
      vata: number;
      pitta: number;
      kapha: number;
    };
    allergies: string[];
    preferences: string[];
    context: {
      meal_type: "breakfast" | "lunch" | "dinner";
      season: "summer" | "winter" | "monsoon";
    };
  };
  constraints: {
    max_calories: number;
    diet_type: "vegetarian" | "vegan";
  };
  meta: {
    timestamp: number;
    request_source: string;
    cache_allowed: boolean;
  };
};
