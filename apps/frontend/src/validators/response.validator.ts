import { z } from "zod";
import { traceSchema } from "@/validators/trace.validator";

const mealItemSchema = z.object({
  recipe_id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.object({
    value: z.number().nonnegative(),
    unit: z.string().min(1),
  }).strict(),
}).strict();

const nutritionSummarySchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
}).strict();

const confidenceSchema = z.object({
  version: z.literal("Confidence_v1"),
  schema_version: z.literal(1),
  compatibility: z.literal("backward"),
  value: z.number().min(0).max(1),
  level: z.enum(["low", "medium", "high"]),
  components: z.object({
    penalty_impact: z.number().min(0).max(1),
    diversity_impact: z.number().min(0).max(1),
    relaxation_impact: z.number().min(0).max(1),
  }).strict(),
}).strict();

const citationSchema = z.object({
  text_id: z.string().min(1),
  source: z.string().min(1),
  chapter: z.string().min(1),
}).strict();

const explanationSchema = z.object({
  deterministic: z.string(),
  ai_explanation: z.string(),
  citations: z.array(citationSchema),
}).strict();

const metaSchema = z.object({
  latency_ms: z.number().int().nonnegative(),
  cache_hit: z.boolean(),
  served_latency_ms: z.number().int().nonnegative().optional(),
  model_version: z.string().min(1),
  prompt_version: z.string().min(1),
  rules_version: z.string().min(1),
  cache_error: z.boolean().optional(),
}).strict();

export const decisionResponseSchema = z.object({
  version: z.literal("DecisionResponse_v1"),
  schema_version: z.literal(1),
  compatibility: z.literal("backward"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  meal_plan: z.array(mealItemSchema).min(1),
  nutrition_summary: nutritionSummarySchema,
  score: z.number().min(0).max(1),
  confidence: confidenceSchema,
  trace: traceSchema,
  explanation: explanationSchema,
  meta: metaSchema,
}).strict();

export type DecisionResponseSchema = z.infer<typeof decisionResponseSchema>;

export function validateDecisionResponse(payload: unknown) {
  return decisionResponseSchema.safeParse(payload);
}
