import { z } from "zod";
import { apiClient, type ApiResult } from "@/services/api/apiClient";

const prakritiAnswersSchema = z.object({
  body_build: z.enum(["thin", "medium", "heavy"]),
  skin: z.enum(["dry", "warm_oily", "thick_cool"]),
  appetite: z.enum(["irregular", "strong", "slow"]),
  energy: z.enum(["variable", "intense", "stable"]),
  nature: z.enum(["anxious", "irritable", "calm"]),
  sleep: z.enum(["light", "moderate", "deep"]),
  climate: z.enum(["warm", "cool", "dry"]),
  food_response: z.enum(["bloated", "acidic", "sluggish"]),
  work_style: z.enum(["inconsistent", "intense", "steady"]),
  weight: z.enum(["lose", "stable", "gain"]),
}).strict();

export const prakritiRequestSchema = z.object({
  answers: prakritiAnswersSchema,
  symptoms: z.array(z.string().min(1)).optional(),
}).strict();

export const prakritiResponseSchema = z.object({
  vata: z.number().min(0).max(1),
  pitta: z.number().min(0).max(1),
  kapha: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  source: z.enum(["rule", "hybrid"]),
}).strict();

export type PrakritiEstimateRequest = z.infer<typeof prakritiRequestSchema>;
export type PrakritiEstimateResponse = z.infer<typeof prakritiResponseSchema>;

export type EstimatePrakritiOptions = {
  signal?: AbortSignal;
  requestId?: string;
  traceId?: string;
  requestVersion?: number;
};

export async function estimatePrakriti(
  input: PrakritiEstimateRequest,
  options: EstimatePrakritiOptions = {}
): Promise<ApiResult<PrakritiEstimateResponse>> {
  return apiClient<PrakritiEstimateResponse>({
    method: "POST",
    path: "/prakriti/estimate",
    body: input,
    requestSchema: prakritiRequestSchema,
    requestId: options.requestId,
    traceId: options.traceId,
    signal: options.signal,
    headers: options.requestVersion !== undefined
      ? { "x-prakriti-request-version": String(options.requestVersion) }
      : undefined,
    responseSchema: prakritiResponseSchema,
  });
}
