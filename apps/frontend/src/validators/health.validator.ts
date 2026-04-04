import { z } from "zod";
import { traceSchema } from "@/validators/trace.validator";

const serviceCheckSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
}).strict();

export const healthResponseSchema = z.object({
  version: z.literal("HealthResponse_v1"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  trace: traceSchema,
  status: z.enum(["ok", "degraded"]),
  checks: z.object({
    db: serviceCheckSchema,
    redis: serviceCheckSchema,
    ai: serviceCheckSchema,
  }).strict(),
  meta: z.object({
    latency_ms: z.number().int().nonnegative(),
    request_id: z.string().min(1),
    trace_id: z.string().min(1),
  }).strict(),
}).strict();

export type HealthResponseSchema = z.infer<typeof healthResponseSchema>;

export function validateHealthResponse(payload: unknown) {
  return healthResponseSchema.safeParse(payload);
}
