export type WeeklyMealEntry = {
  recipe_id: string;
  name: string;
  quantity: {
    value: number;
    unit: string;
  };
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

export type WeeklyDayPlan = {
  day: number;
  meal_plan: WeeklyMealEntry[];
  nutrition_summary: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  score: number;
  confidence: number;
};

export type PlanWeeklyResponseV1 = {
  weekly_plan: WeeklyDayPlan[];
  trace_summary: {
    days: number;
    p0_passed?: number;
    p0_failed?: number;
    violations?: string[];
    stages: Record<string, unknown>;
  };
};
