import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import { nowEpochSeconds } from "@/utils/time";
import { generateRequestId, generateTraceId } from "@/utils/ids";

export type PlanBuilderFormState = {
  profile: {
    name: string;
    age: number | null;
    gender: "male" | "female" | "other";
    height_cm: number | null;
    weight_kg: number | null;
  };
  user_id: string;
  goals: string[];
  risk_flags: string[];
  symptoms: string[];
  prakriti: {
    vata: number;
    pitta: number;
    kapha: number;
  } | null;
  prakriti_confidence: number | null;
  allergies: string[];
  preferences: string[];
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"];
  season: DecisionRequestV1["user_state"]["context"]["season"];
  max_calories: number;
  diet_type: DecisionRequestV1["constraints"]["diet_type"];
  cache_allowed: boolean;
  request_source: string;
};

export function createInitialPlanBuilderFormState(): PlanBuilderFormState {
  return {
    profile: {
      name: "",
      age: null,
      gender: "other",
      height_cm: null,
      weight_kg: null,
    },
    user_id: "",
    goals: [],
    risk_flags: [],
    symptoms: [],
    prakriti: null,
    prakriti_confidence: null,
    allergies: [],
    preferences: [],
    meal_type: "lunch",
    season: "summer",
    max_calories: 0,
    diet_type: "vegetarian",
    cache_allowed: false,
    request_source: "frontend_console",
  };
}

function cleanStringArray(values: string[]): string[] {
  return values
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumber(value: number | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function buildDecisionRequest(
  formState: PlanBuilderFormState,
  identity?: { request_id?: string; trace_id?: string }
): DecisionRequestV1 {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: identity?.request_id || generateRequestId(),
    trace_id: identity?.trace_id || generateTraceId(),
    user_state: {
      user_id: formState.user_id.trim(),
      goals: cleanStringArray(formState.goals),
      risk_flags: cleanStringArray(formState.risk_flags),
      symptoms: cleanStringArray(formState.symptoms),
      dosha_estimate: {
        vata: normalizeNumber(formState.prakriti?.vata),
        pitta: normalizeNumber(formState.prakriti?.pitta),
        kapha: normalizeNumber(formState.prakriti?.kapha),
      },
      allergies: cleanStringArray(formState.allergies),
      preferences: cleanStringArray(formState.preferences),
      context: {
        meal_type: formState.meal_type,
        season: formState.season,
      },
    },
    constraints: {
      max_calories: normalizeNumber(formState.max_calories),
      diet_type: formState.diet_type,
    },
    meta: {
      timestamp: nowEpochSeconds(),
      request_source: formState.request_source.trim(),
      cache_allowed: formState.cache_allowed,
    },
  };
}

