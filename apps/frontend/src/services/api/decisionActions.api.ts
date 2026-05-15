import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import { apiClient, type ApiResult } from "@/services/api/apiClient";
import { decisionResponseSchema } from "@/validators/response.validator";
import { z } from "zod";

type ActionDecisionContext = {
  goal: string | null;
  prakriti: {
    vata: number;
    pitta: number;
    kapha: number;
  };
  conditions: string[];
  constraints: {
    max_calories: number;
    diet_type: string;
  };
};

const replaceFoodRequestSchema = z.object({
  request_id: z.string().min(1),
  meal_id: z.string().min(1),
  food_item: z.string().min(1),
  meal_type: z.string().min(1),
  season: z.string().min(1),
  constraints: z.object({
    max_calories: z.number().nonnegative(),
    diet_type: z.string().min(1),
  }).strict(),
  context: z.object({
    goal: z.string().nullable(),
    prakriti: z.object({
      vata: z.number().min(0).max(1),
      pitta: z.number().min(0).max(1),
      kapha: z.number().min(0).max(1),
    }).strict(),
    conditions: z.array(z.string()),
  }).strict(),
}).strict();

const regenerateRequestSchema = z.object({
  request_id: z.string().min(1),
  meal_id: z.string().min(1),
  meal_type: z.string().min(1),
  season: z.string().min(1),
  constraints: z.object({
    max_calories: z.number().nonnegative(),
    diet_type: z.string().min(1),
  }).strict(),
  context: z.object({
    goal: z.string().nullable(),
    prakriti: z.object({
      vata: z.number().min(0).max(1),
      pitta: z.number().min(0).max(1),
      kapha: z.number().min(0).max(1),
    }).strict(),
    conditions: z.array(z.string()),
  }).strict(),
}).strict();

function toActionContext(context: ActionDecisionContext) {
  return {
    goal: context.goal,
    prakriti: context.prakriti,
    conditions: context.conditions,
  };
}

export async function replaceFoodApi(input: {
  request_id: string;
  meal_id: string;
  food_item: string;
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"];
  season: DecisionRequestV1["user_state"]["context"]["season"];
  decision_context: ActionDecisionContext;
}): Promise<ApiResult<DecisionResponseV1>> {
  return apiClient<DecisionResponseV1>({
    method: "POST",
    path: "/replace-food",
    body: {
      request_id: input.request_id,
      meal_id: input.meal_id,
      food_item: input.food_item,
      meal_type: input.meal_type,
      season: input.season,
      constraints: input.decision_context.constraints,
      context: toActionContext(input.decision_context),
    },
    requestSchema: replaceFoodRequestSchema,
    responseSchema: decisionResponseSchema,
  });
}

export async function regenerateMealApi(input: {
  request_id: string;
  meal_id: string;
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"];
  season: DecisionRequestV1["user_state"]["context"]["season"];
  decision_context: ActionDecisionContext;
}): Promise<ApiResult<DecisionResponseV1>> {
  return apiClient<DecisionResponseV1>({
    method: "POST",
    path: "/regenerate-meal",
    body: {
      request_id: input.request_id,
      meal_id: input.meal_id,
      meal_type: input.meal_type,
      season: input.season,
      constraints: input.decision_context.constraints,
      context: toActionContext(input.decision_context),
    },
    requestSchema: regenerateRequestSchema,
    responseSchema: decisionResponseSchema,
  });
}
