import { z } from "zod";

const contextSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner"]),
  season: z.enum(["summer", "winter", "monsoon"]),
}).strict();

const doshaSchema = z.object({
  vata: z.number().min(0).max(1),
  pitta: z.number().min(0).max(1),
  kapha: z.number().min(0).max(1),
}).strict();

const userStateSchema = z.object({
  user_id: z.string().min(1),
  goals: z.array(z.string().min(1)),
  risk_flags: z.array(z.string().min(1)),
  symptoms: z.array(z.string().min(1)),
  dosha_estimate: doshaSchema,
  allergies: z.array(z.string().min(1)),
  preferences: z.array(z.string().min(1)),
  context: contextSchema,
}).strict();

const constraintsSchema = z.object({
  max_calories: z.number().min(0),
  diet_type: z.enum(["vegetarian", "vegan"]),
}).strict();

const metaSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  request_source: z.string().min(1),
  cache_allowed: z.boolean(),
}).strict();

export const decisionRequestSchema = z.object({
  version: z.literal("DecisionRequest_v1"),
  schema_version: z.literal(1),
  compatibility: z.literal("backward"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  user_state: userStateSchema,
  constraints: constraintsSchema,
  meta: metaSchema,
}).strict().superRefine((payload, ctx) => {
  const sum = payload.user_state.dosha_estimate.vata
    + payload.user_state.dosha_estimate.pitta
    + payload.user_state.dosha_estimate.kapha;

  if (Math.abs(sum - 1) > 0.03) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["user_state", "dosha_estimate"],
      message: "Dosha sum must be close to 1.0 (+/- 0.03)",
    });
  }
});

export type DecisionRequestSchema = z.infer<typeof decisionRequestSchema>;

export function validateDecisionRequest(payload: unknown) {
  return decisionRequestSchema.safeParse(payload);
}
