import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { ErrorResponseV1 } from "@/contracts/ErrorResponseV1";
import type { TraceV1 } from "@/contracts/TraceV1";
import type { PlanWeeklyRequestV1 } from "@/contracts/PlanWeeklyRequestV1";
import type { PlanWeeklyResponseV1 } from "@/contracts/PlanWeeklyResponseV1";
import { ContractValidationError, type ApiResult } from "@/services/api/apiClient";
import { decisionRequestSchema } from "@/validators/request.validator";
import { dailyResponseSchema } from "@/validators/dailyResponse.validator";
import { planWeeklyResponseSchema } from "@/validators/planWeeklyResponse.validator";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUTH_TOKEN_KEY = "aarogya_auth_token";

function ensureDecisionRequest(request: DecisionRequestV1, routePath: string): void {
  if (!request || typeof request !== "object" || Array.isArray(request) || Object.keys(request).length === 0) {
    throw new Error(`Planner payload missing for ${routePath}`);
  }

  const parsed = decisionRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(`Invalid planner payload for ${routePath}`);
  }
}

function ensureWeeklyRequest(request: PlanWeeklyRequestV1): void {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("Invalid weekly planner payload.");
  }

  const userContext = request.user_context;
  if (!userContext || typeof userContext !== "object" || Array.isArray(userContext)) {
    throw new Error("Invalid weekly planner payload: user_context missing.");
  }

  if (typeof userContext.user_id !== "string" || userContext.user_id.trim().length === 0) {
    throw new Error("Invalid weekly planner payload: user_id missing.");
  }

  if (request.days !== undefined) {
    const safeDays = Math.trunc(Number(request.days));
    if (!Number.isFinite(safeDays) || safeDays < 1 || safeDays > 7) {
      throw new Error("Invalid weekly planner payload: days must be between 1 and 7.");
    }
  }
}

function resolveToken(): string | null {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token && token.trim().length > 0 ? token : null;
  } catch {
    return null;
  }
}

function toSafeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toSafeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toSafeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeMealPlanItem(entry: unknown) {
  const item = toSafeObject(entry);
  const quantity = toSafeObject(item.quantity);
  const base = {
    recipe_id: toSafeString(item.recipe_id || item.id, crypto.randomUUID()),
    name: toSafeString(item.name, "Meal"),
    quantity: {
      value: Math.max(0, toSafeNumber(quantity.value, 0)),
      unit: toSafeString(quantity.unit, "grams"),
    },
  };

  const nutritionRaw = toSafeObject(item.nutrition);
  const hasNutrition = ["calories", "protein", "carbs", "fat"].some(
    (key) => typeof nutritionRaw[key] === "number" && Number.isFinite(nutritionRaw[key] as number),
  );

  if (!hasNutrition) {
    return base;
  }

  return {
    ...base,
    nutrition: {
      calories: Math.max(0, toSafeNumber(nutritionRaw.calories, 0)),
      protein: Math.max(0, toSafeNumber(nutritionRaw.protein, 0)),
      carbs: Math.max(0, toSafeNumber(nutritionRaw.carbs, 0)),
      fat: Math.max(0, toSafeNumber(nutritionRaw.fat, 0)),
    },
  };
}

function toFallbackTrace(traceId: string, timestamp: number): TraceV1 {
  return {
    version: "Trace_v1",
    schema_version: 1,
    compatibility: "backward",
    trace_id: traceId,
    timestamp,
    stages: {
      interpretation_layer: {
        ml_used: false,
        ml_confidence: 0,
        ml_contribution_weight: 0,
      },
      candidate_generator: { input_count: 0, output_count: 0 },
      constraint_engine: {
        input_count: 0,
        output_count: 0,
        rejected: 0,
        rules: [],
        p0_rules_checked: 0,
        p0_violations: 0,
        p0_violated_rule_ids: [],
      },
      scoring_engine: { input_count: 0, output_count: 0 },
      diversity_engine: { input_count: 0, output_count: 0 },
      optimizer: { input_count: 0, output_count: 0, combinations_evaluated: 0, selected_score: 0 },
      reliability_engine: { input_count: 0, output_count: 0 },
    },
  };
}

function normalizeDecisionResponse(data: unknown): DecisionResponseV1 {
  const safe = toSafeObject(data);
  const now = Date.now();

  return {
    version: "DecisionResponse_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: toSafeString(safe.request_id, crypto.randomUUID()),
    trace_id: toSafeString(safe.trace_id, crypto.randomUUID()),
    meal_plan: toSafeArray(safe.meal_plan).map(normalizeMealPlanItem),
    nutrition_summary: {
      calories: toSafeNumber(toSafeObject(safe.nutrition_summary).calories, 0),
      protein: toSafeNumber(toSafeObject(safe.nutrition_summary).protein, 0),
      carbs: toSafeNumber(toSafeObject(safe.nutrition_summary).carbs, 0),
      fat: toSafeNumber(toSafeObject(safe.nutrition_summary).fat, 0),
    },
    score: toSafeNumber(safe.score, 0),
    confidence: {
      version: "Confidence_v1",
      schema_version: 1,
      compatibility: "backward",
      value: toSafeNumber(toSafeObject(safe.confidence).value, 0),
      level: ((): "low" | "medium" | "high" => {
        const level = toSafeString(toSafeObject(safe.confidence).level, "low");
        return level === "medium" || level === "high" ? level : "low";
      })(),
      components: {
        penalty_impact: toSafeNumber(toSafeObject(toSafeObject(safe.confidence).components).penalty_impact, 1),
        diversity_impact: toSafeNumber(toSafeObject(toSafeObject(safe.confidence).components).diversity_impact, 1),
        relaxation_impact: toSafeNumber(toSafeObject(toSafeObject(safe.confidence).components).relaxation_impact, 1),
      },
    },
    trace: (toSafeObject(safe.trace) as TraceV1).version ? (safe.trace as TraceV1) : toFallbackTrace(toSafeString(safe.trace_id, "trace_fallback"), now),
    explanation: {
      deterministic: toSafeString(toSafeObject(safe.explanation).deterministic, "Deterministic plan generated."),
      ai_explanation: toSafeString(toSafeObject(safe.explanation).ai_explanation, ""),
      citations: toSafeArray(toSafeObject(safe.explanation).citations),
    },
    insights: toSafeArray<string>(safe.insights),
    warnings: toSafeArray<string>(safe.warnings),
    meta: {
      latency_ms: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(safe.meta).latency_ms, 0))),
      cache_hit: Boolean(toSafeObject(safe.meta).cache_hit),
      served_latency_ms: Math.max(0, Math.trunc(toSafeNumber(toSafeObject(safe.meta).served_latency_ms, 0))),
      model_version: toSafeString(toSafeObject(safe.meta).model_version, "assistive_offline_v1"),
      prompt_version: toSafeString(toSafeObject(safe.meta).prompt_version, "prompt_v1"),
      rules_version: toSafeString(toSafeObject(safe.meta).rules_version, "rules_v1"),
      cache_error: Boolean(toSafeObject(safe.meta).cache_error),
    },
  };
}

function normalizeDailyResponse(data: unknown) {
  const safe = toSafeObject(data);
  const meals = toSafeObject(safe.meals);
  const meta = toSafeObject(safe.meta);

  return {
    meals: {
      breakfast: normalizeDecisionResponse(meals.breakfast),
      lunch: normalizeDecisionResponse(meals.lunch),
      dinner: normalizeDecisionResponse(meals.dinner),
    },
    meta: {
      score_avg: clamp01(toSafeNumber(meta.score_avg, 0)),
      confidence_avg: clamp01(toSafeNumber(meta.confidence_avg, 0)),
      ...(meta.cache_error === true ? { cache_error: true } : {}),
    },
  };
}

function normalizeWeeklyResponse(data: unknown): PlanWeeklyResponseV1 {
  const safe = toSafeObject(data);
  const weeklyPlan = toSafeArray<Record<string, unknown>>(safe.weekly_plan).map((dayRaw, index) => {
    const day = toSafeObject(dayRaw);
    return {
      day: Math.max(1, Math.min(7, Math.trunc(toSafeNumber(day.day, index + 1)))),
      meal_plan: toSafeArray<Record<string, unknown>>(day.meal_plan).map((mealRaw) => {
        const meal = toSafeObject(mealRaw);
        const nutritionRaw = toSafeObject(meal.nutrition);
        const hasNutrition = Object.keys(nutritionRaw).length > 0;

        return {
          recipe_id: toSafeString(meal.recipe_id, crypto.randomUUID()),
          name: toSafeString(meal.name, "Meal"),
          quantity: {
            value: Math.max(0, toSafeNumber(toSafeObject(meal.quantity).value, 0)),
            unit: toSafeString(toSafeObject(meal.quantity).unit, "grams"),
          },
          ...(hasNutrition ? {
            nutrition: {
              calories: Math.max(0, toSafeNumber(nutritionRaw.calories, 0)),
              protein: Math.max(0, toSafeNumber(nutritionRaw.protein, 0)),
              carbs: Math.max(0, toSafeNumber(nutritionRaw.carbs, 0)),
              fat: Math.max(0, toSafeNumber(nutritionRaw.fat, 0)),
            },
          } : {}),
        };
      }),
      nutrition_summary: {
        calories: Math.max(0, toSafeNumber(toSafeObject(day.nutrition_summary).calories, 0)),
        protein: Math.max(0, toSafeNumber(toSafeObject(day.nutrition_summary).protein, 0)),
        carbs: Math.max(0, toSafeNumber(toSafeObject(day.nutrition_summary).carbs, 0)),
        fat: Math.max(0, toSafeNumber(toSafeObject(day.nutrition_summary).fat, 0)),
      },
      score: Math.max(0, Math.min(1, toSafeNumber(day.score, 0))),
      confidence: Math.max(0, Math.min(1, toSafeNumber(day.confidence, 0))),
    };
  });

  const traceSummary = toSafeObject(safe.trace_summary);

  return {
    weekly_plan: weeklyPlan,
    trace_summary: {
      days: Math.max(1, Math.min(7, Math.trunc(toSafeNumber(traceSummary.days, weeklyPlan.length || 7)))),
      p0_passed: Math.max(0, Math.trunc(toSafeNumber(traceSummary.p0_passed, 0))),
      p0_failed: Math.max(0, Math.trunc(toSafeNumber(traceSummary.p0_failed, 0))),
      violations: toSafeArray(traceSummary.violations).map((v) => String(v)),
      stages: toSafeObject(traceSummary.stages),
    },
  };
}

function toApiError(message: string): ErrorResponseV1 {
  return {
    version: "ErrorResponse_v1",
    request_id: "unknown_request",
    trace_id: "unknown_trace",
    trace: toFallbackTrace("unknown_trace", Date.now()),
    error: {
      code: "PLAN_API_ERROR",
      message,
      details: {},
    },
  };
}

export async function generatePlan(request: DecisionRequestV1): Promise<ApiResult<DecisionResponseV1>> {
  if (!BASE_URL || typeof BASE_URL !== "string") {
    throw new Error("Planner service base URL is not configured.");
  }

  ensureDecisionRequest(request, "/plan");
  const startedAt = Date.now();

  const token = resolveToken();
  console.log("[Plan API] POST /plan request payload", request);

  const res = await fetch(`${BASE_URL}/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  const response = await res.json();
  console.log("[Plan API] /plan parsed response", response);

  if (!res.ok) {
    const message = response?.error?.message || response?.message || "Plan request failed.";
    return {
      data: null,
      error: toApiError(message),
      meta: {
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const isSuccess = response?.success === true;
  const result = response?.data && typeof response.data === "object" ? response.data : null;
  const hasMealPlan = Array.isArray(result?.meal_plan);

  if (!isSuccess || !hasMealPlan) {
    return {
      data: null,
      error: toApiError("Unexpected response: missing success flag or data.meal_plan."),
      meta: {
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  return {
    data: normalizeDecisionResponse(result),
    error: null,
    meta: {
      status: res.status,
      durationMs: Date.now() - startedAt,
    },
  };
}

export async function generateDailyPlan(request: DecisionRequestV1): Promise<ApiResult<DailyResponseV1>> {
  if (!BASE_URL || typeof BASE_URL !== "string") {
    throw new Error("Planner service base URL is not configured.");
  }

  ensureDecisionRequest(request, "/plan/daily");
  const startedAt = Date.now();
  const token = resolveToken();

  console.log("[Plan API] POST /plan/daily request payload", request);

  const res = await fetch(`${BASE_URL}/plan/daily`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  const response = await res.json();
  console.log("[Plan API] /plan/daily parsed response", response);

  if (!res.ok) {
    const message = response?.error?.message || response?.message || "Daily plan request failed.";
    return {
      data: null,
      error: toApiError(message),
      meta: {
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const normalized = normalizeDailyResponse(response);
  const parsed = dailyResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new ContractValidationError("Response contract validation failed", {
      path: "/plan/daily",
      issues: parsed.error.issues,
    });
  }

  return {
    data: parsed.data,
    error: null,
    meta: {
      status: res.status,
      durationMs: Date.now() - startedAt,
    },
  };
}

export async function generateWeeklyPlan(request: PlanWeeklyRequestV1): Promise<ApiResult<PlanWeeklyResponseV1>> {
  if (!BASE_URL || typeof BASE_URL !== "string") {
    throw new Error("Planner service base URL is not configured.");
  }

  ensureWeeklyRequest(request);
  const startedAt = Date.now();
  const token = resolveToken();

  console.log("[Plan API] POST /plan/weekly request payload", request);

  const res = await fetch(`${BASE_URL}/plan/weekly`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  const response = await res.json();
  console.log("[Plan API] /plan/weekly parsed response", response);

  if (!res.ok) {
    const message = response?.error?.message || response?.message || "Weekly plan request failed.";
    return {
      data: null,
      error: toApiError(message),
      meta: {
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const normalized = normalizeWeeklyResponse(response);
  const parsed = planWeeklyResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      data: null,
      error: toApiError("Unexpected weekly response format."),
      meta: {
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  return {
    data: parsed.data,
    error: null,
    meta: {
      status: res.status,
      durationMs: Date.now() - startedAt,
    },
  };
}

export const planApi = generatePlan;
