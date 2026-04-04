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

export const traceSchema = z.object({
  version: z.literal("Trace_v1"),
  schema_version: z.literal(1),
  compatibility: z.literal("backward"),
  trace_id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  stages: z.object({
    candidate_generator: stageCountSchema,
    constraint_engine: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      rules: z.array(traceRuleSchema),
    }).strict(),
    scoring_engine: stageCountSchema,
    diversity_engine: stageCountSchema,
    optimizer: z.object({
      input_count: z.number().int().nonnegative(),
      output_count: z.number().int().nonnegative(),
      combinations_evaluated: z.number().int().nonnegative(),
      selected_score: z.number().min(0).max(1),
    }).strict(),
    reliability_engine: stageCountSchema,
  }).strict(),
}).strict();

export type TraceSchema = z.infer<typeof traceSchema>;

export function validateTrace(payload: unknown) {
  return traceSchema.safeParse(payload);
}
