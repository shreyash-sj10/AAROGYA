import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { UserContext } from "@/store/userContext.store";
import { decisionRequestSchema } from "@/validators/request.validator";

type DecisionContextInput = {
  meal_type: DecisionRequestV1["user_state"]["context"]["meal_type"];
  season: DecisionRequestV1["user_state"]["context"]["season"];
};

function trimNonEmpty(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

function resolveUserId(): string {
  if (typeof localStorage === "undefined") {
    return "frontend_user";
  }

  const key = "ayudiet_user_id";
  const existing = localStorage.getItem(key);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated = `frontend_user_${crypto.randomUUID()}`;
  localStorage.setItem(key, generated);
  return generated;
}

function resolveDietType(raw: string | null): DecisionRequestV1["constraints"]["diet_type"] {
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

  const symptoms = trimNonEmpty(userContext.symptoms.extracted_tags);
  if (symptoms.length === 0) {
    throw new Error("Symptoms are required before generating a plan.");
  }

  const calorieLimit = userContext.constraints.calorie_limit ?? undefined;
  if (calorieLimit !== undefined && calorieLimit <= 0) {
    throw new Error("Invalid calorie_limit");
  }
  if (calorieLimit === undefined) {
    throw new Error("Calorie limit is required before generating a plan.");
  }

  const mealType = resolveMealType(contextInput?.meal_type);
  const season = resolveSeason(contextInput?.season);

  const request: DecisionRequestV1 = {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: crypto.randomUUID(),
    trace_id: crypto.randomUUID(),
    user_state: {
      user_id: resolveUserId(),
      goals: [goal],
      risk_flags: trimNonEmpty([
        ...userContext.health.conditions,
        ...userContext.health.dietary_restrictions,
      ]),
      symptoms,
      dosha_estimate: {
        vata: userContext.prakriti.vata,
        pitta: userContext.prakriti.pitta,
        kapha: userContext.prakriti.kapha,
      },
      allergies: trimNonEmpty(userContext.health.allergies),
      preferences: trimNonEmpty([
        ...userContext.health.dietary_restrictions,
        ...userContext.constraints.exclusions,
      ]),
      context: {
        meal_type: mealType,
        season,
      },
    },
    constraints: {
      max_calories: calorieLimit,
      diet_type: resolveDietType(userContext.constraints.diet_type),
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
