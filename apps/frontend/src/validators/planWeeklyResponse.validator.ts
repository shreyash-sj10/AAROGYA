import { z } from "zod";

const weeklyMealSchema = z.object({
  recipe_id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.object({
    value: z.number().min(0),
    unit: z.string().min(1),
  }).strict(),
  nutrition: z.object({
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
  }).strict().optional(),
}).strict();

const weeklyDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  meal_plan: z.array(weeklyMealSchema).min(1),
  nutrition_summary: z.object({
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
  }).strict(),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
}).strict();

export const planWeeklyResponseSchema = z.object({
  weekly_plan: z.array(weeklyDaySchema).min(1),
  trace_summary: z.object({
    days: z.number().int().min(1).max(7),
    p0_passed: z.number().int().min(0).optional(),
    p0_failed: z.number().int().min(0).optional(),
    violations: z.array(z.string()).optional(),
    stages: z.record(z.string(), z.unknown()),
  }).strict(),
}).strict();

export type PlanWeeklyResponseSchema = z.infer<typeof planWeeklyResponseSchema>;
