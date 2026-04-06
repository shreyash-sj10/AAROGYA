import { z } from "zod";

const traceRuleSchema = z.object({
  rule_id: z.string().min(1),
  action: z.enum(["reject", "penalize"]),
  reason: z.string().min(1),
}).strict();

const stageCountSchema = z.object({
  input_count: z.number().int().nonnegative(),
  output_count: z.number().int().nonnegative(),
}).strict();

const interpretationLayerSchema = z.object({
  ml_used: z.boolean(),
  ml_confidence: z.number().min(0).max(1),
  ml_contribution_weight: z.number().min(0).max(0.4),
}).strict();

const confidenceEvalSchema = z.object({
  relaxation_impact: z.number().min(0).max(1),
  pool_quality: z.number().min(0).max(1),
  score_confidence: z.number().min(0).max(1),
  penalty_impact: z.number().min(0).max(1),
  diversity_impact: z.number().min(0).max(1),
}).strict();

const refinementLoopSchema = z.object({
  round: z.number().int().nonnegative(),
  triggered_questions: z.array(z.string()),
  reason: z.string(),
  impact_on_confidence: z.number(),
}).strict();

export const traceSchema = z.object({
  version: z.literal("Trace_v1"),
  schema_version: z.literal(1),
  compatibility: z.literal("backward"),
  trace_id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  refinement_loop: refinementLoopSchema.optional(),
  stages: z.object({
    interpretation_layer: interpretationLayerSchema,
    candidate_generator: stageCountSchema,
    constraint_engine: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      rules: z.array(traceRuleSchema),
      p0_rules_checked: z.number().int().nonnegative(),
      p0_violations: z.number().int().nonnegative(),
      p0_violated_rule_ids: z.array(z.string().min(1)),
    }).strict(),
    scoring_engine: stageCountSchema,
    diversity_engine: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      historical_matches_count: z.number().int().nonnegative().optional(),
      diversity_penalty_applied: z.number().nonnegative().optional(),
    }).strict(),
    optimizer: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      combinations_evaluated: z.number().int().nonnegative(),
      selected_score: z.number().min(0).max(1),
    }).strict(),
    reliability_engine: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      relaxation_level: z.number().int().min(0).max(4).optional(),
      relaxed_priorities: z.array(z.string()).optional(),
      confidence_eval: confidenceEvalSchema.optional(),
    }).strict(),
  }).strict(),
}).strict();

export type TraceSchema = z.infer<typeof traceSchema>;

export function validateTrace(payload: unknown) {
  return traceSchema.safeParse(payload);
}
