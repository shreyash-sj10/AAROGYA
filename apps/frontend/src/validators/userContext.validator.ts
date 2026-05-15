import { z } from "zod";

export const userContextSchema = z.object({
  profile: z.object({
    name: z.string(),
    age: z.number().int().nullable(),
    gender: z.enum(["male", "female", "other"]).nullable(),
    activity_level: z.string().nullable(),
    height: z.number(),
    weight: z.number(),
  }).strict(),
  health: z.object({
    conditions: z.array(z.string()),
    allergies: z.array(z.string()),
    dietary_restrictions: z.array(z.string()),
  }).strict(),
  symptoms: z.object({
    text: z.string(),
    extracted_tags: z.array(z.string()),
  }).strict(),
  prakriti: z.object({
    vata: z.number(),
    pitta: z.number(),
    kapha: z.number(),
    confidence: z.number(),
  }).strict().nullable(),
  goals: z.string().nullable(),
  constraints: z.object({
    diet_type: z.string().nullable(),
    calorie_limit: z.number().nullable(),
    exclusions: z.array(z.string()),
  }).strict(),
}).strict();

export type UserContextSnapshot = z.infer<typeof userContextSchema>;
