import { useMemo } from "react";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { PlanWeeklyResponseV1 } from "@/contracts/PlanWeeklyResponseV1";
import type { UserContext } from "@/store/userContext.store";
import type { PlannerPlanType } from "@/store/plan.store";
import { PlanChat } from "@/app/planner/components/PlanChat";

type ActionKind = "replace" | "regenerate_meal" | "regenerate_plan";

type MealType = "breakfast" | "lunch" | "dinner";

type MealCard = {
  meal_type: MealType;
  response: DecisionResponseV1;
};

export type PlannerResultProps = {
  planType: PlannerPlanType;
  plan: DecisionResponseV1 | null;
  dailyPlan: DailyResponseV1 | null;
  weeklyPlan: PlanWeeklyResponseV1 | null;
  userContext: UserContext;
  chatConstraints: {
    max_calories: number;
    diet_type: string;
  };
  plannerContext: {
    meals: Array<{
      meal_id: string;
      name: string;
      items: string[];
      meal_type: MealType;
    }>;
    plan_type: PlannerPlanType;
    meal_type: MealType | null;
    diet_type: string;
    preferences: string[];
    exclusions: string[];
  };
  selectedMealType: MealType | null;
  error: string | null;
  actionLoading: { kind: ActionKind; target: string } | null;
  onReplaceFood: (mealId: string, foodId: string, mealType: MealType) => Promise<boolean>;
  onRegenerateMeal: (mealId: string, mealType: MealType) => Promise<boolean>;
  onRegeneratePlan: () => Promise<boolean>;
  onCreateNewPlan: () => void;
};

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}

function toPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function titleCaseMealType(value: MealType): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveMealCards(planType: PlannerPlanType, plan: DecisionResponseV1 | null, dailyPlan: DailyResponseV1 | null, selectedMealType: MealType | null): MealCard[] {
  if (planType === "full_day" && dailyPlan) {
    return [
      { meal_type: "breakfast", response: dailyPlan.meals.breakfast },
      { meal_type: "lunch", response: dailyPlan.meals.lunch },
      { meal_type: "dinner", response: dailyPlan.meals.dinner },
    ];
  }

  if (planType !== "single_meal" || !plan || !selectedMealType) {
    return [];
  }

  return [
    {
      meal_type: selectedMealType,
      response: plan,
    },
  ];
}

function computeWeeklyAverages(weeklyPlan: PlanWeeklyResponseV1 | null) {
  const days = weeklyPlan?.weekly_plan ?? [];
  if (days.length === 0) {
    return { score: 0, confidence: 0 };
  }

  const score = days.reduce((sum, day) => sum + Math.max(0, Math.min(1, day.score)), 0) / days.length;
  const confidence = days.reduce((sum, day) => sum + Math.max(0, Math.min(1, day.confidence)), 0) / days.length;

  return { score, confidence };
}

export function PlannerResultView({
  planType,
  plan,
  dailyPlan,
  weeklyPlan,
  userContext,
  chatConstraints,
  plannerContext,
  selectedMealType,
  error,
  actionLoading,
  onReplaceFood,
  onRegenerateMeal,
  onRegeneratePlan,
  onCreateNewPlan,
}: PlannerResultProps) {
  const mealCards = useMemo(() => resolveMealCards(planType, plan, dailyPlan, selectedMealType), [planType, plan, dailyPlan, selectedMealType]);

  const isLoadingAction = (kind: ActionKind, target: string) =>
    actionLoading?.kind === kind && actionLoading.target === target;

  const anyActionLoading = Boolean(actionLoading);

  const weeklyAverages = useMemo(() => computeWeeklyAverages(weeklyPlan), [weeklyPlan]);

  const globalScore = useMemo(() => {
    if (planType === "weekly") {
      return toPercent(weeklyAverages.score);
    }
    if (planType === "full_day" && dailyPlan) {
      return toPercent(dailyPlan.meta.score_avg);
    }
    if (plan) {
      return toPercent(plan.score);
    }
    return 0;
  }, [planType, plan, dailyPlan, weeklyAverages]);

  const globalConfidence = useMemo(() => {
    if (planType === "weekly") {
      return toPercent(weeklyAverages.confidence);
    }
    if (planType === "full_day" && dailyPlan) {
      return toPercent(dailyPlan.meta.confidence_avg);
    }
    if (plan) {
      return toPercent(plan.confidence.value);
    }
    return 0;
  }, [planType, plan, dailyPlan, weeklyAverages]);

  const chatPlan = planType === "full_day" && dailyPlan ? dailyPlan : (planType === "single_meal" ? plan : null);

  return (
    <section className="space-y-6 ui-fade-in">
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ui-fade-in">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCreateNewPlan}
          disabled={anyActionLoading}
          className="plan-btn-secondary w-full sm:w-auto"
        >
          Create New Plan
        </button>
        <button
          type="button"
          onClick={() => { void onRegeneratePlan(); }}
          disabled={anyActionLoading}
          className="plan-btn-primary w-full sm:w-auto"
        >
          {isLoadingAction("regenerate_plan", "plan") ? <Spinner /> : null}
          {planType === "weekly" ? "Regenerate Weekly Plan" : planType === "full_day" ? "Regenerate Full Day" : "Regenerate Plan"}
        </button>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <article className="ui-fade-in-delay min-w-0 space-y-5 rounded-2xl border border-[color:var(--plan-border)] bg-[color:var(--plan-bg)] p-4 shadow-sm sm:p-6">
          <header>
            <p className="text-xs uppercase tracking-wide text-[color:var(--plan-label)]">Decision Output</p>
            <h2 className="mt-2 text-lg font-semibold text-[#2F2F2F]">
              {planType === "weekly" ? "Weekly Plan" : planType === "full_day" ? "Daily Plan" : "Recommended Meal"}
            </h2>
          </header>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="ui-elevate rounded-2xl border border-[#E6E1D8] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Score</p>
              <p className="mt-2 text-2xl font-semibold text-[#2F2F2F]">{globalScore}%</p>
            </div>
            <div className="ui-elevate rounded-2xl border border-[#E6E1D8] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Confidence</p>
              <p className="mt-2 inline-flex rounded-full border border-[#d2c4aa] bg-[#f8f2e7] px-3 py-1 text-sm font-semibold text-[#4e4534] ui-soft-pulse">
                {globalConfidence}%
              </p>
            </div>
          </section>

          {planType === "weekly" && weeklyPlan ? (
            <div className="space-y-4">
              {weeklyPlan.weekly_plan.map((day) => (
                <section key={`day-${day.day}`} className="ui-elevate rounded-2xl border border-[color:var(--plan-border)] bg-white p-4 shadow-sm sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--plan-label)]">Day {day.day}</p>
                  <ul className="mt-2 space-y-1.5">
                    {day.meal_plan.map((meal) => (
                      <li key={`${day.day}-${meal.recipe_id}`} className="safe-text text-sm font-medium text-[color:var(--plan-text)] sm:text-base">
                        {meal.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-[color:var(--plan-muted)]">Score {toPercent(day.score)}% | Confidence {toPercent(day.confidence)}%</p>
                  <p className="mt-2 text-sm text-[color:var(--plan-muted)]">
                    Calories {Math.round(day.nutrition_summary.calories)} kcal, Protein {Math.round(day.nutrition_summary.protein)}g, Carbs {Math.round(day.nutrition_summary.carbs)}g, Fat {Math.round(day.nutrition_summary.fat)}g
                  </p>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {mealCards.map((item) => {
                const meal = item.response.meal_plan[0];
                const scorePercent = toPercent(item.response.score);
                const confidencePercent = toPercent(item.response.confidence.value);
                const mealId = meal?.recipe_id || `${item.meal_type}-meal`;
                const mealName = meal?.name || "Meal";

                return (
                  <section key={`${item.meal_type}:${mealId}`} className="ui-elevate rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{titleCaseMealType(item.meal_type)}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { void onReplaceFood(mealId, mealName, item.meal_type); }}
                          disabled={anyActionLoading}
                          className="plan-btn-secondary !px-3 !py-1.5 !text-xs"
                        >
                          {isLoadingAction("replace", `${mealId}:${mealName}:${item.meal_type}`) ? <Spinner /> : null}
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => { void onRegenerateMeal(mealId, item.meal_type); }}
                          disabled={anyActionLoading}
                          className="plan-btn-secondary !px-3 !py-1.5 !text-xs"
                        >
                          {isLoadingAction("regenerate_meal", `${mealId}:${item.meal_type}`) ? <Spinner /> : null}
                          Regenerate Meal
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2 text-xl font-semibold text-[#2F2F2F]">{mealName}</h3>
                    <p className="mt-1 text-sm text-gray-600">Score {scorePercent}% | Confidence {confidencePercent}%</p>
                    <p className="mt-2 text-sm text-gray-700">{item.response.explanation.deterministic}</p>
                    {item.response.explanation.ai_explanation ? (
                      <p className="mt-2 text-sm text-gray-700">{item.response.explanation.ai_explanation}</p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </article>

        <aside className="ui-panel-enter min-w-0 w-full max-w-full">
          {chatPlan ? (
            <PlanChat
              plan={chatPlan}
              userContext={userContext}
              constraints={chatConstraints}
              plannerContext={{
                meals: plannerContext.meals,
                diet_type: plannerContext.diet_type,
                preferences: plannerContext.preferences,
                exclusions: plannerContext.exclusions,
              }}
              latestError={error}
              disabled={anyActionLoading}
              onReplaceFood={onReplaceFood}
              onRegenerateMeal={onRegenerateMeal}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}

