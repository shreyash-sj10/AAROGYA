import { orchestrateQuery } from "@/ai/orchestrator";
import { AIRequestType } from "@/ai/ai.contract";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { UserContext } from "@/store/userContext.store";

export type PlanChatMealContext = {
  meal_id: string;
  name: string;
  items: string[];
  meal_type: "breakfast" | "lunch" | "dinner";
};

export type PlanChatAction =
  | { type: "replace_food"; payload: { meal_id: string; food_id: string; meal_type: "breakfast" | "lunch" | "dinner" } }
  | { type: "regenerate_meal"; payload: { meal_id: string; meal_type: "breakfast" | "lunch" | "dinner" } };

export type PlanChatResult = {
  type: "explanation" | "action" | "clarify" | "error";
  message: string;
  action?: PlanChatAction;
};

const MISSING_INPUT_MESSAGE = "Please complete required fields.";
const NO_CANDIDATES_MESSAGE = "No valid plan found under constraints.";
const INVALID_ACTION_MESSAGE = "I couldn't understand that request.";
const EXPLAIN_NOT_AVAILABLE_MESSAGE = "Explanation not available";
const CHAT_SESSION_KEY = "aarogya_chat_session_id";

function resolveChatSessionId(): string {
  if (typeof localStorage === "undefined") {
    return `chat_${crypto.randomUUID()}`;
  }

  const existing = localStorage.getItem(CHAT_SESSION_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated = `chat_${crypto.randomUUID()}`;
  localStorage.setItem(CHAT_SESSION_KEY, generated);
  return generated;
}

function mapAssistantErrorMessage(message: string | null | undefined): string {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("missing")
    || normalized.includes("required")
    || normalized.includes("diet type")
    || normalized.includes("diet_type")
    || normalized.includes("meal type")
    || normalized.includes("meal_type")
    || normalized.includes("calorie")
    || normalized.includes("planner inputs")
  ) {
    return MISSING_INPUT_MESSAGE;
  }

  if (
    normalized.includes("no valid")
    || normalized.includes("no candidates")
    || normalized.includes("constraints")
    || normalized.includes("no_valid_plan")
  ) {
    return NO_CANDIDATES_MESSAGE;
  }

  return INVALID_ACTION_MESSAGE;
}

type AssistantActionContract = {
  type: "action" | "explain" | "clarify";
  action?: {
    kind: "replace_food" | "regenerate_meal";
    meal_type: "breakfast" | "lunch" | "dinner";
    target?: string;
  } | null;
  message?: string;
};

function toMealPlans(plan: DecisionResponseV1 | DailyResponseV1): DecisionResponseV1[] {
  if ("meals" in plan) {
    return [plan.meals.breakfast, plan.meals.lunch, plan.meals.dinner];
  }
  return [plan];
}

function extractAllMealItems(plan: DecisionResponseV1 | DailyResponseV1) {
  return toMealPlans(plan).flatMap((entry) => entry.meal_plan || []);
}

function isActionLikeMessage(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("replace")
    || text.includes("swap")
    || text.includes("change")
    || text.includes("regenerate")
    || text.includes("again")
  );
}

async function getActionContract(userInput: string, context?: Record<string, unknown>): Promise<AssistantActionContract | null> {
  const prompt = String(userInput || "").trim().toLowerCase();
  if (!prompt) return null;

  const safeContext = (context && typeof context === "object" ? context : {}) as Record<string, unknown>;
  const plan = (safeContext.plan && typeof safeContext.plan === "object" ? safeContext.plan : {}) as Record<string, unknown>;
  const meals = Array.isArray(plan.meals)
    ? plan.meals
    : (Array.isArray(safeContext.meals) ? safeContext.meals : []);

  const detectMealType = () => {
    if (prompt.includes("breakfast") || prompt.includes("morning")) return "breakfast" as const;
    if (prompt.includes("lunch") || prompt.includes("midday") || prompt.includes("afternoon")) return "lunch" as const;
    if (prompt.includes("dinner") || prompt.includes("evening")) return "dinner" as const;
    if (meals.length === 1) {
      const mealType = String((meals[0] as Record<string, unknown>).meal_type || "").toLowerCase();
      if (mealType === "breakfast" || mealType === "lunch" || mealType === "dinner") return mealType;
    }
    return null;
  };

  const hasReplace = prompt.includes("replace") || prompt.includes("swap") || prompt.includes("change");
  const hasRegenerate = prompt.includes("regenerate") || prompt.includes("again");
  const isQuestion = prompt.includes("?") || /^(why|what|how|when|where|which|explain|reason)\b/.test(prompt);

  if (hasReplace) {
    const targetMatch = prompt.match(/\b(replace|swap|change)\b\s+(.+)$/);
    const target = targetMatch && targetMatch[2] ? targetMatch[2].trim() : "";
    const mealType = detectMealType();
    if (!mealType || !target) {
      return { type: "clarify", action: null, message: "Specify which meal and what to replace." };
    }

    return {
      type: "action",
      action: {
        kind: "replace_food",
        meal_type: mealType,
        target,
      },
    };
  }

  if (hasRegenerate) {
    const mealType = detectMealType();
    if (!mealType) {
      return { type: "clarify", action: null, message: "Specify breakfast, lunch, or dinner to regenerate." };
    }

    return {
      type: "action",
      action: {
        kind: "regenerate_meal",
        meal_type: mealType,
      },
    };
  }

  if (isQuestion) {
    return { type: "explain", action: null };
  }

  return { type: "clarify", action: null, message: "Specify an action like replace lunch dal or regenerate dinner." };
}

function findMealByType(meals: PlanChatMealContext[] | undefined, mealType: "breakfast" | "lunch" | "dinner") {
  const safeMeals = Array.isArray(meals) ? meals : [];
  return safeMeals.find((meal) => meal.meal_type === mealType) || null;
}

function buildExplainDecisionContext(input: {
  plan: DecisionResponseV1 | DailyResponseV1;
  userContext: UserContext;
  constraints: {
    max_calories: number;
    diet_type: string;
  };
  plannerContext?: {
    diet_type: string;
    preferences: string[];
    exclusions: string[];
  };
  explainRequested: boolean;
}) {
  const allMeals = extractAllMealItems(input.plan);
  const decisionTrace = "trace" in input.plan ? (input.plan.trace || {}) : {};
  const selectedMeal = {
    name: allMeals[0]?.name || "",
    items: allMeals.map((meal) => meal.name).filter(Boolean),
  };
  const constraintsApplied = {
    max_calories: input.constraints.max_calories,
    diet_type: input.plannerContext?.diet_type || input.constraints.diet_type,
    preferences: input.plannerContext?.preferences || [],
    exclusions: input.plannerContext?.exclusions || [],
  };

  return {
    session_id: resolveChatSessionId(),
    explain_requested: input.explainRequested,
    dosha: input.userContext.prakriti,
    conditions: input.userContext.health.conditions,
    user_profile: {
      prakriti: input.userContext.prakriti,
      conditions: input.userContext.health.conditions,
      risk_flags: input.userContext.symptoms.extracted_tags,
    },
    decision_trace: decisionTrace,
    selected_meal: selectedMeal,
    constraints_applied: constraintsApplied,
    current_plan: {
      selected_meal: selectedMeal,
      constraints_applied: constraintsApplied,
      decision_trace: decisionTrace,
      trace: decisionTrace,
    },
  };
}

export async function askPlanExplanation(input: {
  plan: DecisionResponseV1 | DailyResponseV1;
  userContext: UserContext;
  constraints: {
    max_calories: number;
    diet_type: string;
  };
  plannerContext?: {
    meals: PlanChatMealContext[];
    diet_type: string;
    preferences: string[];
    exclusions: string[];
  };
}): Promise<string> {
  const orchestration = await orchestrateQuery("Explain this meal decision", {
    userContext: buildExplainDecisionContext({
      plan: input.plan,
      userContext: input.userContext,
      constraints: input.constraints,
      plannerContext: input.plannerContext ? {
        diet_type: input.plannerContext.diet_type,
        preferences: input.plannerContext.preferences,
        exclusions: input.plannerContext.exclusions,
      } : undefined,
      explainRequested: true,
    }),
  });

  if (orchestration.meta?.reason === "deterministic_only") {
    return EXPLAIN_NOT_AVAILABLE_MESSAGE;
  }

  return orchestration.text || EXPLAIN_NOT_AVAILABLE_MESSAGE;
}

export async function askPlanAssistant(input: {
  message: string;
  plan: DecisionResponseV1 | DailyResponseV1;
  userContext: UserContext;
  constraints: {
    max_calories: number;
    diet_type: string;
  };
  plannerContext?: {
    meals: PlanChatMealContext[];
    diet_type: string;
    preferences: string[];
    exclusions: string[];
  };
}): Promise<PlanChatResult> {
  try {
    const hasRequiredInputs = Boolean(
      extractAllMealItems(input.plan).length
      && input.constraints?.diet_type
      && Number.isFinite(input.constraints?.max_calories)
      && input.constraints.max_calories > 0,
    );

    if (!hasRequiredInputs) {
      return { type: "error", message: MISSING_INPUT_MESSAGE };
    }

    const orchestration = await orchestrateQuery(input.message, {
      userContext: buildExplainDecisionContext({
        plan: input.plan,
        userContext: input.userContext,
        constraints: input.constraints,
        plannerContext: input.plannerContext ? {
          diet_type: input.plannerContext.diet_type,
          preferences: input.plannerContext.preferences,
          exclusions: input.plannerContext.exclusions,
        } : undefined,
        explainRequested: false,
      }),
    });

    if (orchestration.intent === AIRequestType.INVALID_REQUEST) {
      return { type: "clarify", message: orchestration.text || INVALID_ACTION_MESSAGE };
    }

    if (
      orchestration.intent === AIRequestType.EXPLAIN_DECISION
      || orchestration.intent === AIRequestType.INTERPRET_SYMPTOMS
    ) {
      if (orchestration.meta?.reason === "deterministic_only") {
        return { type: "explanation", message: EXPLAIN_NOT_AVAILABLE_MESSAGE };
      }
      return { type: "explanation", message: orchestration.text || INVALID_ACTION_MESSAGE };
    }

    if (orchestration.intent === AIRequestType.KNOWLEDGE_QUERY && !isActionLikeMessage(input.message)) {
      return { type: "explanation", message: orchestration.text || INVALID_ACTION_MESSAGE };
    }

    const mealsPayload = input.plannerContext?.meals || [];
    const contract = await getActionContract(input.message, {
      plan: {
        plan_id: "meals" in input.plan ? "daily_plan" : input.plan.request_id,
        meals: mealsPayload,
      },
      meals: mealsPayload,
      diet_type: input.plannerContext?.diet_type || input.constraints.diet_type,
      preferences: input.plannerContext?.preferences || [],
      exclusions: input.plannerContext?.exclusions || [],
    });

    if (!contract) {
      return { type: "error", message: orchestration.text || INVALID_ACTION_MESSAGE };
    }

    if (contract.type === "clarify") {
      return {
        type: "clarify",
        message: contract.message || "Can you specify what you'd like to change?",
      };
    }

    if (contract.type === "explain") {
      return {
        type: "explanation",
        message: EXPLAIN_NOT_AVAILABLE_MESSAGE,
      };
    }

    const action = contract.action;
    if (!action) {
      return { type: "clarify", message: "Please specify a complete action." };
    }

    const targetMeal = findMealByType(input.plannerContext?.meals, action.meal_type);
    if (!targetMeal) {
      return { type: "clarify", message: "Please specify which meal to update." };
    }

    if (action.kind === "replace_food") {
      const foodTarget = typeof action.target === "string" ? action.target.trim() : "";
      if (!foodTarget) {
        return { type: "clarify", message: "Please specify what food to replace." };
      }

      return {
        type: "action",
        message: "Applying your requested change...",
        action: {
          type: "replace_food",
          payload: {
            meal_id: targetMeal.meal_id,
            food_id: foodTarget,
            meal_type: action.meal_type,
          },
        },
      };
    }

    return {
      type: "action",
      message: "Applying your requested change...",
      action: {
        type: "regenerate_meal",
        payload: {
          meal_id: targetMeal.meal_id,
          meal_type: action.meal_type,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { type: "error", message: mapAssistantErrorMessage(message) };
  }
}
