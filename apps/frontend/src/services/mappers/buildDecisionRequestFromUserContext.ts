import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { UserContext } from "@/store/userContext.store";
import { decisionRequestSchema } from "@/validators/request.validator";
import type { PlannerMealPreference } from "@/store/plan.store";
import { useAuthStore } from "@/store/auth.store";

type DecisionContextInput = {
  meal_type?: DecisionRequestV1["user_state"]["context"]["meal_type"];
  season?: DecisionRequestV1["user_state"]["context"]["season"];
  calorie_limit?: number;
  diet_type?: DecisionRequestV1["constraints"]["diet_type"];
  exclusions?: string[];
  preferences?: string[];
  meal_preference?: PlannerMealPreference | null;
};

function sanitizeToken(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  // Keep exclusions/preferences predictable and contract-safe.
  const cleaned = trimmed.replace(/[^a-z0-9\s\-_]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  return cleaned;
}

function sanitizeList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  items.forEach((item) => {
    const token = sanitizeToken(item);
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  });

  return out;
}

function readTokenFromStorage(): string | null {
  try {
    const token = localStorage.getItem("aarogya_auth_token");
    return token && token.trim().length > 0 ? token : null;
  } catch {
    return null;
  }
}

function readUserIdFromStorage(): string | null {
  try {
    const userId = localStorage.getItem("aarogya_user_id");
    return userId && userId.trim().length > 0 ? userId.trim() : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveUserId(): string {
  const authUserId = useAuthStore.getState().user?.id;
  if (typeof authUserId === "string" && authUserId.trim().length > 0) {
    return authUserId.trim();
  }

  const persistedUserId = readUserIdFromStorage();
  if (persistedUserId) {
    return persistedUserId;
  }

  const token = useAuthStore.getState().token || readTokenFromStorage();
  if (token) {
    const claims = decodeJwtPayload(token);
    const claimCandidates = [
      claims?.sub,
      claims?.user_id,
      claims?.uid,
      claims?.id,
    ];

    for (const candidate of claimCandidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  throw new Error("Authenticated user ID is required for plan generation.");
}

function resolveDietType(raw: string | null | undefined): DecisionRequestV1["constraints"]["diet_type"] {
  if (!raw) {
    throw new Error("Missing required constraint: diet_type");
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "vegan") {
    return "vegan";
  }
  if (normalized === "vegetarian") {
    return "vegetarian";
  }
  throw new Error("Invalid diet_type");
}

function resolveMealType(raw: unknown): DecisionRequestV1["user_state"]["context"]["meal_type"] {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (normalized === "breakfast" || normalized === "lunch" || normalized === "dinner") {
    return normalized;
  }
  throw new Error("Missing required context: meal_type");
}

function resolveSeason(raw: unknown): DecisionRequestV1["user_state"]["context"]["season"] {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (normalized === "summer" || normalized === "winter" || normalized === "monsoon") {
    return normalized;
  }
  throw new Error("Missing required context: season");
}

function ensureProfileFields(context: UserContext): void {
  if (context.profile.age === null || context.profile.age <= 0) {
    throw new Error("Profile age is required for plan generation.");
  }
  if (context.profile.gender === null) {
    throw new Error("Profile gender is required for plan generation.");
  }
  if (!Number.isFinite(context.profile.height) || context.profile.height <= 0) {
    throw new Error("Profile height is required for plan generation.");
  }
  if (!Number.isFinite(context.profile.weight) || context.profile.weight <= 0) {
    throw new Error("Profile weight is required for plan generation.");
  }
}

export function buildDecisionRequestFromUserContext(
  userContext: UserContext,
  contextInput?: DecisionContextInput,
): DecisionRequestV1 {
  ensureProfileFields(userContext);

  if (!userContext.prakriti) {
    throw new Error("Prakriti assessment is required before generating a plan.");
  }

  const goal = String(userContext.goals ?? "").trim();
  if (!goal) {
    throw new Error("Goal is required before generating a plan.");
  }

  const symptoms = sanitizeList(userContext.symptoms.extracted_tags);
  if (symptoms.length === 0) {
    throw new Error("Symptoms are required before generating a plan.");
  }

  const calorieLimit = contextInput?.calorie_limit ?? userContext.constraints.calorie_limit ?? undefined;
  if (calorieLimit !== undefined && calorieLimit <= 0) {
    throw new Error("Invalid calorie_limit");
  }
  if (calorieLimit === undefined) {
    throw new Error("Calorie limit is required before generating a plan.");
  }

  const mealType = resolveMealType(contextInput?.meal_type);
  const season = resolveSeason(contextInput?.season);
  const dietType = resolveDietType(contextInput?.diet_type ?? userContext.constraints.diet_type);

  const exclusions = sanitizeList(contextInput?.exclusions ?? userContext.constraints.exclusions);
  const explicitPreferences = sanitizeList(contextInput?.preferences ?? []);
  const dietaryRestrictions = sanitizeList(userContext.health.dietary_restrictions);

  const mealPreferenceTag = contextInput?.meal_preference
    ? `meal_preference:${contextInput.meal_preference}`
    : null;

  const preferences = sanitizeList([
    ...dietaryRestrictions,
    ...exclusions,
    ...explicitPreferences,
    ...(mealPreferenceTag ? [mealPreferenceTag] : []),
  ]);

  const request: DecisionRequestV1 = {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: crypto.randomUUID(),
    trace_id: crypto.randomUUID(),
    user_state: {
      user_id: resolveUserId(),
      goals: [goal],
      risk_flags: sanitizeList([
        ...userContext.health.conditions,
        ...userContext.health.dietary_restrictions,
      ]),
      symptoms,
      dosha_estimate: {
        vata: userContext.prakriti.vata,
        pitta: userContext.prakriti.pitta,
        kapha: userContext.prakriti.kapha,
      },
      allergies: sanitizeList(userContext.health.allergies),
      preferences,
      context: {
        meal_type: mealType,
        season,
      },
    },
    constraints: {
      max_calories: calorieLimit,
      diet_type: dietType,
    },
    meta: {
      timestamp: Date.now(),
      request_source: "frontend_app",
      cache_allowed: true,
    },
  };

  const parsed = decisionRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(`Decision request validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

export { sanitizeList };

