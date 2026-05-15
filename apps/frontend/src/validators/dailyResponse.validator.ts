import { z } from "zod";
import { decisionResponseSchema } from "@/validators/response.validator";

export const dailyResponseSchema = z.object({
  meals: z.object({
    breakfast: decisionResponseSchema,
    lunch: decisionResponseSchema,
    dinner: decisionResponseSchema,
  }).strict(),
  meta: z.object({
    score_avg: z.number().min(0).max(1),
    confidence_avg: z.number().min(0).max(1),
    cache_error: z.boolean().optional(),
  }).strict(),
}).strict();

export type DailyResponseSchema = z.infer<typeof dailyResponseSchema>;
