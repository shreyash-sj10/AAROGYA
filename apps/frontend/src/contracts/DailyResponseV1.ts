import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";

export type DailyResponseV1 = {
  meals: {
    breakfast: DecisionResponseV1;
    lunch: DecisionResponseV1;
    dinner: DecisionResponseV1;
  };
  meta: {
    score_avg: number;
    confidence_avg: number;
    cache_error?: boolean;
  };
};
