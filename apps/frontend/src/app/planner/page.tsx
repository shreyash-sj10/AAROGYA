import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContractValidationError } from "@/services/api/apiClient";
import { generatePlan, generateDailyPlan, generateWeeklyPlan } from "@/services/api/plan.api";
import { replaceFoodApi, regenerateMealApi } from "@/services/api/decisionActions.api";
import { buildDecisionRequestFromUserContext, sanitizeList } from "@/services/mappers/buildDecisionRequestFromUserContext";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { PlanWeeklyRequestV1 } from "@/contracts/PlanWeeklyRequestV1";
import type { PlanWeeklyResponseV1 } from "@/contracts/PlanWeeklyResponseV1";
import { usePlanStore } from "@/store/plan.store";
import { useUserContextStore } from "@/store/userContext.store";
import { PlannerConfigView, type PlanType, type MealPreference } from "@/app/planner/components/PlannerConfigView";
import { PlannerResultView } from "@/app/planner/components/PlannerResultView";

type ActionKind = "replace" | "regenerate_meal" | "regenerate_plan";
type MealType = DecisionRequestV1["user_state"]["context"]["meal_type"];

function inferSeasonFromDate(date: Date): DecisionRequestV1["user_state"]["context"]["season"] {
  const month = date.getMonth() + 1;
  if (month >= 7 && month <= 10) return "monsoon";
  if (month >= 11 || month <= 2) return "winter";
  return "summer";
}

function mapErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("diet_type") || normalized.includes("diet type")) {
    return "Please select diet type.";
  }

  if (normalized.includes("meal_type") || normalized.includes("meal type")) {
    return "Please choose meal type.";
  }

  if (normalized.includes("calorie") || normalized.includes("max_calories")) {
    return "Please provide a valid calorie target.";
  }

  if (normalized.includes("single-meal response") || normalized.includes("single meal response")) {
    return "Unexpected planner response for Single Meal. Please regenerate.";
  }

  if (normalized.includes("dailyresponse_v1")) {
    return "Daily planner response failed contract validation.";
  }

  if (normalized.includes("no valid") || normalized.includes("no candidates") || normalized.includes("constraints")) {
    return "No valid plan found under constraints.";
  }

  if (normalized.includes("response contract validation failed")) {
    return "Plan was generated but the response shape did not match the app contract. Refresh the page and try again; if it persists, check backend/frontend versions.";
  }

  if (normalized.includes("plan request failed") || normalized.includes("planner response format is invalid")) {
    return "Plan service returned an unexpected response. Please try again.";
  }

  if (normalized.includes("no meals were returned")) {
    return "No meals matched your current calories/preferences/restrictions. Please adjust and retry.";
  }

  if (normalized.includes("missing required")) {
    return "Please complete required fields.";
  }

  if (normalized.includes("empty meal plan") || normalized.includes("response is empty")) {
    return "No valid meals were generated. Please adjust calories/preferences/restrictions and try again.";
  }

  if (normalized.includes("authenticated user id") || normalized.includes("auth")) {
    return "Session context missing. Please log out and log in again.";
  }

  if (normalized.includes("profile") || normalized.includes("prakriti") || normalized.includes("goal") || normalized.includes("symptom") || normalized.includes("onboarding")) {
    return "Complete onboarding context before generating a plan.";
  }

  return message && message.trim().length > 0 ? message : "I couldn't understand that request.";
}

function computeDailyMeta(meals: DailyResponseV1["meals"]) {
  const all = [meals.breakfast, meals.lunch, meals.dinner];
  const scoreAvg = all.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.score)), 0) / all.length;
  const confidenceAvg = all.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.confidence.value)), 0) / all.length;

  return {
    score_avg: Number(scoreAvg.toFixed(6)),
    confidence_avg: Number(confidenceAvg.toFixed(6)),
  };
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const userContext = useUserContextStore((s) => s.userContext);
  const plan = usePlanStore((state) => state.plan);
  const dailyPlan = usePlanStore((state) => state.dailyPlan);
  const weeklyPlan = usePlanStore((state) => state.weeklyPlan);
  const persistedInputs = usePlanStore((s) => s.plannerInputs);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setDailyPlan = usePlanStore((s) => s.setDailyPlan);
  const setWeeklyPlan = usePlanStore((s) => s.setWeeklyPlan);
  const setPlannerInputs = usePlanStore((s) => s.setPlannerInputs);
  const clearPlan = usePlanStore((s) => s.clearPlan);

  const inferredSeason = inferSeasonFromDate(new Date());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ kind: ActionKind; target: string } | null>(null);

  const showBlockingError = (message: string) => {
    setError(message);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const [planType, setPlanType] = useState<PlanType>(persistedInputs.plan_type ?? "single_meal");
  const [calorieTarget, setCalorieTarget] = useState<number | null>(persistedInputs.calorie_limit ?? userContext.constraints.calorie_limit);
  const [exclusionInput, setExclusionInput] = useState("");
  const [dietaryExclusions, setDietaryExclusions] = useState<string[]>(persistedInputs.exclusions ?? []);
  const [mealPreference, setMealPreference] = useState<MealPreference>(persistedInputs.meal_preference ?? "balanced");
  const [mealType, setMealType] = useState<DecisionRequestV1["user_state"]["context"]["meal_type"] | null>(persistedInputs.meal_type ?? null);
  const [dietType, setDietType] = useState<DecisionRequestV1["constraints"]["diet_type"] | null>(
    persistedInputs.diet_type
    ?? (userContext.constraints.diet_type === "vegan"
      ? "vegan"
      : userContext.constraints.diet_type === "vegetarian"
        ? "vegetarian"
        : null),
  );

  const effectiveCalorieTarget = calorieTarget ?? persistedInputs.calorie_limit ?? null;
  const effectiveMealType = mealType ?? persistedInputs.meal_type ?? null;
  const effectiveSeason = persistedInputs.season ?? inferredSeason;
  const effectiveDietType = dietType ?? persistedInputs.diet_type ?? null;
  const effectiveExclusions = useMemo(
    () => sanitizeList(dietaryExclusions.length > 0 ? dietaryExclusions : persistedInputs.exclusions ?? []),
    [dietaryExclusions, persistedInputs.exclusions],
  );
  const effectiveMealPreference = mealPreference ?? persistedInputs.meal_preference ?? "balanced";

  const hasSinglePlan = Boolean(plan && Array.isArray(plan.meal_plan) && plan.meal_plan.length > 0);
  const hasFullDayPlan = Boolean(dailyPlan);
  const hasWeeklyPlan = Boolean(weeklyPlan && Array.isArray(weeklyPlan.weekly_plan) && weeklyPlan.weekly_plan.length > 0);
  const hasPlan = hasSinglePlan || hasFullDayPlan || hasWeeklyPlan;
  const activePlanType: PlanType = hasWeeklyPlan ? "weekly" : (hasFullDayPlan ? "full_day" : "single_meal");

  const setPlanState = (
    single: DecisionResponseV1 | null,
    daily: DailyResponseV1 | null,
    weekly: PlanWeeklyResponseV1 | null,
    lastSingleRequest?: DecisionRequestV1 | null,
  ) => {
    if (weekly) {
      setWeeklyPlan(weekly);
      return;
    }

    if (daily) {
      setDailyPlan(daily);
      return;
    }

    if (single) {
      setPlan(single, lastSingleRequest);
      return;
    }

    clearPlan();
  };

  const actionContext = useMemo(() => ({
    goal: userContext.goals,
    prakriti: {
      vata: userContext.prakriti?.vata ?? 0,
      pitta: userContext.prakriti?.pitta ?? 0,
      kapha: userContext.prakriti?.kapha ?? 0,
    },
    conditions: userContext.health.conditions,
    constraints: {
      max_calories: effectiveCalorieTarget ?? 0,
      diet_type: effectiveDietType ?? "",
    },
  }), [userContext, effectiveCalorieTarget, effectiveDietType]);

  const addExclusion = () => {
    const candidate = sanitizeList([exclusionInput]);
    if (candidate.length === 0) {
      setExclusionInput("");
      return;
    }

    setDietaryExclusions((curr) => sanitizeList([...curr, candidate[0]]));
    setExclusionInput("");
  };

  const removeExclusion = (item: string) => {
    setDietaryExclusions((curr) => curr.filter((x) => x !== item));
  };

  const validateBeforeGenerate = (): string | null => {
    const hasValidContext = Boolean(
      userContext.prakriti
      && userContext.goals
      && Array.isArray(userContext.symptoms.extracted_tags)
      && userContext.symptoms.extracted_tags.length > 0
      && userContext.profile.age
      && userContext.profile.age > 0
      && userContext.profile.gender
      && userContext.profile.height > 0
      && userContext.profile.weight > 0
    );

    if (!hasValidContext) {
      return "Complete onboarding context before generating a plan.";
    }

    if (!planType) return "Please select plan type.";
    if (!effectiveDietType) return "Please select diet type.";
    if (!Number.isFinite(effectiveCalorieTarget) || effectiveCalorieTarget === null || effectiveCalorieTarget <= 0) {
      return "Please provide a valid calorie target.";
    }

    if (planType === "single_meal" && !effectiveMealType) {
      return "Please choose meal type.";
    }

    return null;
  };

  const buildRequest = (mealTypeForRequest: MealType): DecisionRequestV1 => {
    return buildDecisionRequestFromUserContext(userContext, {
      meal_type: mealTypeForRequest,
      season: effectiveSeason,
      calorie_limit: effectiveCalorieTarget ?? undefined,
      diet_type: effectiveDietType ?? undefined,
      exclusions: effectiveExclusions,
      preferences: persistedInputs.preferences,
      meal_preference: effectiveMealPreference,
    });
  };

  const buildWeeklyRequest = (): PlanWeeklyRequestV1 => {
    const seed = buildRequest("breakfast");
    return {
      user_context: {
        user_id: seed.user_state.user_id,
        goals: seed.user_state.goals,
        goal: seed.user_state.goals[0],
        risk_flags: seed.user_state.risk_flags,
        symptoms: seed.user_state.symptoms,
        dosha_estimate: seed.user_state.dosha_estimate,
        allergies: seed.user_state.allergies,
        preferences: seed.user_state.preferences,
        diet_type: seed.constraints.diet_type,
        target_calories: seed.constraints.max_calories,
        context: {
          season: seed.user_state.context.season,
        },
      },
      constraints: {
        max_calories: seed.constraints.max_calories,
        diet_type: seed.constraints.diet_type,
        season: seed.user_state.context.season,
      },
      preferences: {
        liked_foods: [],
        disliked_foods: effectiveExclusions,
        interaction_logs: [],
      },
      days: 7,
    };
  };

  const handleGeneratePlan = async (): Promise<boolean> => {
    console.log("[Planner] Generate button clicked", { loading, actionLoading, planType });
    if (loading || actionLoading) return false;
    setError(null);

    const validationError = validateBeforeGenerate();
    if (validationError) {
      showBlockingError(validationError);
      return false;
    }



    setLoading(true);
    try {
      if (planType === "weekly") {
        const weeklyRequest = buildWeeklyRequest();
        console.log("[Planner] /plan/weekly request", weeklyRequest);
        const response = await generateWeeklyPlan(weeklyRequest);
        if (response.error) {
          throw new Error(response.error.error?.message || "Weekly plan request failed.");
        }
        if (!response.data) {
          throw new Error("Weekly plan response is empty.");
        }

        setPlanState(null, null, response.data);
        setPlannerInputs({
          plan_type: planType,
          meal_type: null,
          season: effectiveSeason,
          diet_type: effectiveDietType,
          calorie_limit: effectiveCalorieTarget,
          exclusions: effectiveExclusions,
          preferences: persistedInputs.preferences,
          meal_preference: effectiveMealPreference,
        });
        navigate("/app/planner/result");
        return true;
      }

      if (planType === "full_day") {
        const request = buildRequest("breakfast");
        console.log("[Planner] /plan/daily request", request);
        const response = await generateDailyPlan(request);
        if (response.error) {
          throw new Error(response.error.error?.message || "Plan request failed.");
        }
        if (!response.data) {
          throw new Error("Daily plan response is empty.");
        }

        setPlanState(null, response.data, null);
        setPlannerInputs({
          plan_type: planType,
          meal_type: null,
          season: effectiveSeason,
          diet_type: effectiveDietType,
          calorie_limit: effectiveCalorieTarget,
          exclusions: effectiveExclusions,
          preferences: persistedInputs.preferences,
          meal_preference: effectiveMealPreference,
        });
        navigate("/app/planner/result");
        return true;
      }

      if (!effectiveMealType) {
        showBlockingError("Please choose meal type.");
        return false;
      }

      const request = buildRequest(effectiveMealType);
      console.log("[Planner] /plan request", request);
      const response = await generatePlan(request);
      if (response.error) {
        throw new Error(response.error.error?.message || "Plan request failed.");
      }
      if (!response.data) {
        throw new Error("Plan response is empty.");
      }

      const result = response.data;
      console.log("[Planner] parsed plan result", result);

      setPlanState(result, null, null, request);
      setPlannerInputs({
        plan_type: planType,
        meal_type: effectiveMealType,
        season: effectiveSeason,
        diet_type: effectiveDietType,
        calorie_limit: effectiveCalorieTarget,
        exclusions: effectiveExclusions,
        preferences: persistedInputs.preferences,
        meal_preference: effectiveMealPreference,
      });
      navigate("/app/planner/result");
      return true;
    } catch (err) {
      const message = err instanceof ContractValidationError || err instanceof Error
        ? err.message
        : "Plan generation failed.";
      console.error("[Planner] generate failed", message, err);
      showBlockingError(mapErrorMessage(message));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const ensureActionInputs = (): boolean => {
    if (activePlanType === "weekly") {
      showBlockingError("Weekly plan actions are not supported yet. Regenerate the weekly plan instead.");
      return false;
    }

    const hasCurrentPlan = hasPlan;
    if (!hasCurrentPlan) {
      showBlockingError("Please generate a plan first.");
      return false;
    }

    if (!effectiveSeason || !effectiveDietType || !Number.isFinite(effectiveCalorieTarget) || effectiveCalorieTarget === null) {
      showBlockingError("Please complete required fields.");
      return false;
    }

    if (!userContext.prakriti) {
      showBlockingError("Please complete required fields.");
      return false;
    }

    return true;
  };

  const handleReplaceFood = async (mealId: string, foodId: string, targetMealType: MealType): Promise<boolean> => {
    if (loading || actionLoading || !ensureActionInputs()) return false;
    setError(null);
    setActionLoading({ kind: "replace", target: `${mealId}:${foodId}:${targetMealType}` });
    try {
      const requestId = activePlanType === "full_day"
        ? dailyPlan?.meals[targetMealType].request_id
        : plan?.request_id;

      if (!requestId) {
        throw new Error("Missing request_id");
      }

      const response = await replaceFoodApi({
        request_id: requestId,
        meal_id: mealId,
        food_item: foodId,
        meal_type: targetMealType,
        season: effectiveSeason,
        decision_context: actionContext,
      });
      if (response.error || !response.data) {
        throw new Error(response.error?.error?.message || "Unable to process request. Please try a more specific question.");
      }

      if (activePlanType === "full_day" && dailyPlan) {
        const updatedMeals = {
          ...dailyPlan.meals,
          [targetMealType]: response.data,
        } as DailyResponseV1["meals"];

        setPlanState(null, {
          meals: updatedMeals,
          meta: computeDailyMeta(updatedMeals),
        }, null);
      } else {
        setPlanState(response.data, null, null);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid action request";
      showBlockingError(mapErrorMessage(message));
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateMeal = async (mealId: string, targetMealType: MealType): Promise<boolean> => {
    if (loading || actionLoading || !ensureActionInputs()) return false;
    setError(null);
    setActionLoading({ kind: "regenerate_meal", target: `${mealId}:${targetMealType}` });
    try {
      const requestId = activePlanType === "full_day"
        ? dailyPlan?.meals[targetMealType].request_id
        : plan?.request_id;

      if (!requestId) {
        throw new Error("Missing request_id");
      }

      const response = await regenerateMealApi({
        request_id: requestId,
        meal_id: mealId,
        meal_type: targetMealType,
        season: effectiveSeason,
        decision_context: actionContext,
      });
      if (response.error || !response.data) {
        throw new Error(response.error?.error?.message || "Unable to process request. Please try a more specific question.");
      }

      if (activePlanType === "full_day" && dailyPlan) {
        const updatedMeals = {
          ...dailyPlan.meals,
          [targetMealType]: response.data,
        } as DailyResponseV1["meals"];

        setPlanState(null, {
          meals: updatedMeals,
          meta: computeDailyMeta(updatedMeals),
        }, null);
      } else {
        setPlanState(response.data, null, null);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid action request";
      showBlockingError(mapErrorMessage(message));
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegeneratePlan = async (): Promise<boolean> => {
    if (loading || actionLoading || !hasPlan) return false;
    setActionLoading({ kind: "regenerate_plan", target: "plan" });
    try {
      return await handleGeneratePlan();
    } finally {
      setActionLoading(null);
    }
  };

  const plannerMeals = useMemo(() => {
    if (activePlanType === "full_day" && dailyPlan) {
      return [
        {
          meal_id: dailyPlan.meals.breakfast.meal_plan[0]?.recipe_id || "breakfast",
          name: dailyPlan.meals.breakfast.meal_plan[0]?.name || "Breakfast",
          items: [dailyPlan.meals.breakfast.meal_plan[0]?.name || "Breakfast"],
          meal_type: "breakfast" as MealType,
        },
        {
          meal_id: dailyPlan.meals.lunch.meal_plan[0]?.recipe_id || "lunch",
          name: dailyPlan.meals.lunch.meal_plan[0]?.name || "Lunch",
          items: [dailyPlan.meals.lunch.meal_plan[0]?.name || "Lunch"],
          meal_type: "lunch" as MealType,
        },
        {
          meal_id: dailyPlan.meals.dinner.meal_plan[0]?.recipe_id || "dinner",
          name: dailyPlan.meals.dinner.meal_plan[0]?.name || "Dinner",
          items: [dailyPlan.meals.dinner.meal_plan[0]?.name || "Dinner"],
          meal_type: "dinner" as MealType,
        },
      ];
    }

    if (activePlanType === "single_meal" && plan && effectiveMealType) {
      return plan.meal_plan.map((meal) => ({
        meal_id: meal.recipe_id,
        name: meal.name,
        items: [meal.name],
        meal_type: effectiveMealType,
      }));
    }

    return [] as Array<{ meal_id: string; name: string; items: string[]; meal_type: MealType }>;
  }, [activePlanType, dailyPlan, plan, effectiveMealType]);


  const handleCreateNewPlan = () => {
    setError(null);
    setActionLoading(null);
    clearPlan();
  };
  const modeHint = planType === "full_day"
    ? "Full day mode runs deterministic breakfast, lunch, and dinner orchestration."
    : planType === "weekly"
      ? "Weekly mode runs deterministic 7-day orchestration through /plan/weekly."
      : null;

  return (
    <section className="space-y-6">
      <header className="plan-header">
        <h1 className="text-xl font-semibold text-[color:var(--plan-text)] sm:text-2xl">{hasPlan ? "Your Personalized Plan" : "Meal Planner"}</h1>
        <p className="mt-2 text-sm text-[color:var(--plan-muted)]">Guided deterministic input builder aligned with backend contracts.</p>
      </header>

      <div className="transition-all duration-300 ease-out">
        {!hasPlan ? (
          <PlannerConfigView
            loading={loading}
            error={error}
            planType={planType}
            calorieTarget={effectiveCalorieTarget}
            exclusionInput={exclusionInput}
            dietaryExclusions={effectiveExclusions}
            mealPreference={effectiveMealPreference}
            mealType={effectiveMealType}
            dietType={effectiveDietType}
            season={effectiveSeason}
            goal={userContext.goals}
            prakriti={{
              vata: userContext.prakriti?.vata ?? 0,
              pitta: userContext.prakriti?.pitta ?? 0,
              kapha: userContext.prakriti?.kapha ?? 0,
            }}
            modeHint={modeHint}
            onSetPlanType={setPlanType}
            onSetCalorieTarget={setCalorieTarget}
            onSetExclusionInput={setExclusionInput}
            onAddExclusion={addExclusion}
            onRemoveExclusion={removeExclusion}
            onSetMealPreference={setMealPreference}
            onSetMealType={setMealType}
            onSetDietType={setDietType}
            onGenerate={() => { void handleGeneratePlan(); }}
            onEditContext={() => navigate("/app/onboarding")}
          />
        ) : (
          <PlannerResultView
            planType={activePlanType}
            plan={plan}
            dailyPlan={dailyPlan}
            weeklyPlan={weeklyPlan}
            userContext={userContext}
            chatConstraints={actionContext.constraints}
            plannerContext={{
              meals: plannerMeals,
              plan_type: activePlanType,
              meal_type: effectiveMealType,
              diet_type: effectiveDietType ?? "",
              preferences: persistedInputs.preferences ?? [],
              exclusions: effectiveExclusions,
            }}
            selectedMealType={effectiveMealType}
            error={error}
            actionLoading={actionLoading}
            onReplaceFood={handleReplaceFood}
            onRegenerateMeal={handleRegenerateMeal}
            onRegeneratePlan={handleRegeneratePlan}
            onCreateNewPlan={handleCreateNewPlan}
          />
        )}
      </div>
    </section>
  );
}



























