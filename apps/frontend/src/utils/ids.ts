import { nowEpochSeconds } from "@/utils/time";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return Math.random().toString(16).slice(2, 14);
}

export function generateRequestId(prefix = "fe"): string {
  return `${prefix}_request_${Date.now().toString(16)}${randomToken()}`;
}

export function generateTraceId(prefix = "fe"): string {
  return `${prefix}_trace_${Date.now().toString(16)}${randomToken()}`;
}

export function createInitialDecisionRequest(): DecisionRequestV1 {
  return {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: generateRequestId(),
    trace_id: generateTraceId(),
    user_state: {
      user_id: "",
      goals: [],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: {
        vata: 0.33,
        pitta: 0.33,
        kapha: 0.34,
      },
      allergies: [],
      preferences: [],
      context: {
        meal_type: "lunch",
        season: "summer",
      },
    },
    constraints: {
      max_calories: 0,
      diet_type: "vegetarian",
    },
    meta: {
      timestamp: nowEpochSeconds(),
      request_source: "frontend_console",
      cache_allowed: false,
    },
  };
}
