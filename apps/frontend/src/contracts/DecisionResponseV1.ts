import type { TraceV1 } from "@/contracts/TraceV1";

export type DecisionResponseV1 = {
  version: "DecisionResponse_v1";
  schema_version: 1;
  compatibility: "backward";
  request_id: string;
  trace_id: string;
  meal_plan: Array<{
    recipe_id: string;
    name: string;
    quantity: {
      value: number;
      unit: string;
    };
  }>;
  nutrition_summary: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  score: number;
  confidence: {
    version: "Confidence_v1";
    schema_version: 1;
    compatibility: "backward";
    value: number;
    level: "low" | "medium" | "high";
    components: {
      penalty_impact: number;
      diversity_impact: number;
      relaxation_impact: number;
    };
  };
  trace: TraceV1;
  explanation: {
    deterministic: string;
    ai_explanation: string;
    citations: Array<{
      text_id: string;
      source: string;
      chapter: string;
    }>;
  };
  meta: {
    latency_ms: number;
    cache_hit: boolean;
    served_latency_ms?: number;
    model_version: string;
    prompt_version: string;
    rules_version: string;
    cache_error?: boolean;
  };
};
