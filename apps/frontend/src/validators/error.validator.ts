import { z } from "zod";
import { traceSchema } from "@/validators/trace.validator";

export const errorResponseSchema = z.object({
  version: z.literal("ErrorResponse_v1"),
  request_id: z.string().min(1),
  trace_id: z.string().min(1),
  trace: traceSchema,
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.unknown()),
  }).strict(),
}).strict();

export type ErrorResponseSchema = z.infer<typeof errorResponseSchema>;

export function validateErrorResponse(payload: unknown) {
  return errorResponseSchema.safeParse(payload);
}
