import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, GitBranch, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { usePlanStore } from "@/state/plan.store";
import { regenerateMealApi, replaceFoodApi } from "@/services/api/decisionActions.api";
import type { DecisionContextV1, DecisionResponseV1 } from "@/contracts/DecisionResponseV1";

function prettyGoal(goal: string | null): string {
  if (!goal) {
    return "Not selected";
  }
  return goal.replace(/^GOAL_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function prettyCondition(flag: string): string {
  const map: Record<string, string> = {
    RISK_DIABETES: "Diabetes",
    RISK_ACIDITY: "Acidity",
    RISK_PCOS: "PCOS",
    RISK_HYPERTENSION: "Hypertension",
    RISK_THYROID: "Thyroid",
  };
  return map[flag] || flag.replace(/^RISK_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function confidencePercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function groupedMeals(data: DecisionResponseV1) {
  const groups: Record<string, DecisionResponseV1["meal_plan"]> = {};

  for (const item of data.meal_plan) {
    const maybeMealTime = (item as unknown as { meal_time?: string }).meal_time;
    const key = maybeMealTime && maybeMealTime.trim() ? maybeMealTime : "recommended";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return Object.entries(groups);
}

export function PlanResultPage() {
  const navigate = useNavigate();
  const { data, loading, error, runPlan, requestDraft, setPlanState } = usePlanStore();

  const [actionLoading, setActionLoading] = useState<"none" | "replace" | "regenerate">("none");
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const actionsDisabled = actionLoading !== "none";
  const actionLabel = actionLoading === "replace"
    ? "Replacing meal and recomputing full snapshot..."
    : actionLoading === "regenerate"
      ? "Regenerating meal and recomputing full snapshot..."
      : null;
  const context = data?.decision_context || null;
  const actionContext = useMemo<DecisionContextV1>(() => {
    if (context) {
      return context;
    }

    return {
      profile: null,
      goal: requestDraft.user_state.goals[0] || null,
      goals: requestDraft.user_state.goals,
      prakriti: requestDraft.user_state.dosha_estimate,
      conditions: requestDraft.user_state.risk_flags,
      constraints: {
        max_calories: requestDraft.constraints.max_calories,
        diet_type: requestDraft.constraints.diet_type,
      },
      confidence: data?.confidence.value || 0,
    };
  }, [context, requestDraft, data]);
  const insights = data?.insights || [];
  const warnings = data?.warnings || [];
  const selectedGoal = prettyGoal(context?.goal || actionContext.goal || null);
  const healthConditions = (context?.conditions || actionContext.conditions || []).map(prettyCondition);
  const contextPrakriti = context?.prakriti || actionContext.prakriti || { vata: 0, pitta: 0, kapha: 0 };
  const mealGroups = useMemo(() => (data ? groupedMeals(data) : []), [data]);

  const scoreValue = useMemo(() => {
    if (!data) return 0;
    const maybeScoreObject = data.score as unknown as { final?: number };
    if (typeof maybeScoreObject?.final === "number") {
      return maybeScoreObject.final;
    }
    return data.score;
  }, [data]);

  const diversityInsight = useMemo(() => {
    if (!data) {
      return "Diversity details appear after a plan is generated.";
    }
    const stage = data.trace.stages;
    return `Diversity filter retained ${stage.diversity_engine.output_count} options before optimization.`;
  }, [data]);

  async function runReplace(recipeId: string) {
    if (!data || actionsDisabled) {
      return;
    }

    setActionError(null);
    setActionLoading("replace");
    setActiveRecipeId(recipeId);

    try {
      const result = await replaceFoodApi({
        request_id: data.request_id,
        meal_id: recipeId,
        food_item: recipeId,
        decision_context: actionContext,
      });

      if (result.error || !result.data) {
        setActionError(result.error?.error?.message || "Replace action failed.");
        return;
      }

      setPlanState(result.data);
    } catch (errorThrown) {
      setActionError(errorThrown instanceof Error ? errorThrown.message : "Replace action failed.");
    } finally {
      setActionLoading("none");
      setActiveRecipeId(null);
    }
  }

  async function runRegenerate(targetRecipeId?: string) {
    if (!data || actionsDisabled) {
      return;
    }

    const mealId = targetRecipeId || data.meal_plan[0]?.recipe_id;
    if (!mealId) {
      setActionError("No meal item available for regeneration.");
      return;
    }

    setActionError(null);
    setActionLoading("regenerate");

    try {
      const result = await regenerateMealApi({
        request_id: data.request_id,
        meal_id: mealId,
        decision_context: actionContext,
      });

      if (result.error || !result.data) {
        setActionError(result.error?.error?.message || "Regenerate action failed.");
        return;
      }

      setPlanState(result.data);
    } catch (errorThrown) {
      setActionError(errorThrown instanceof Error ? errorThrown.message : "Regenerate action failed.");
    } finally {
      setActionLoading("none");
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-textSecondary">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </section>
    );
  }

  if (error) {
    const traceId = error.trace_id || requestDraft.trace_id;
    return (
      <section className="space-y-3 rounded-lg border border-error/50 bg-error/10 p-5">
        <h3 className="text-lg font-semibold text-error">Unable to load plan</h3>
        <p className="text-sm text-error">{error.error.message}</p>
        <p className="text-xs font-mono text-error">trace_id: {traceId}</p>
        <button type="button" onClick={() => void runPlan()} className="inline-flex items-center gap-2 rounded border border-error/60 px-3 py-2 text-sm text-error">
          <RefreshCw size={14} /> Retry
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">System Dashboard</h3>
        <p className="mt-2 text-sm text-textSecondary">No plan available yet. Generate from Plan Builder to view dashboard panels.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <section className="rounded-lg border border-error/50 bg-error/10 p-4">
          <p className="text-sm text-error">{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} className="mt-2 rounded border border-error/60 px-3 py-1 text-xs text-error">Dismiss</button>
        </section>
      ) : null}

      {actionLabel ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-textSecondary">
            <Loader2 size={16} className="animate-spin" />
            <span>{actionLabel}</span>
          </div>
        </section>
      ) : null}

      <div className={`space-y-4 ${actionsDisabled ? "pointer-events-none opacity-70" : ""}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-lg border border-border bg-card p-4 xl:col-span-1">
            <h4 className="text-base font-semibold">User Context</h4>
            <div className="mt-3 space-y-3 text-sm">
              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Profile</p>
                <p className="text-textSecondary">{context?.profile?.name?.trim() || "Name not provided"}</p>
                <p className="text-textSecondary">Age: {context?.profile?.age || "-"} | Gender: {context?.profile?.gender || "-"}</p>
              </div>

              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Goal</p>
                <p className="text-textSecondary">{selectedGoal}</p>
              </div>

              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Prakriti (Derived)</p>
                <p className="text-textSecondary">Vata {confidencePercent(contextPrakriti.vata)} | Pitta {confidencePercent(contextPrakriti.pitta)} | Kapha {confidencePercent(contextPrakriti.kapha)}</p>
                <p className="text-textSecondary">Confidence: {confidencePercent(context?.confidence || data.confidence.value)}</p>
              </div>

              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Health Conditions</p>
                <p className="text-textSecondary">{healthConditions.length > 0 ? healthConditions.join(", ") : "No conditions selected"}</p>
              </div>

              <div>
                <p className="font-medium">Constraints</p>
                <p className="text-textSecondary">Max calories: {context?.constraints.max_calories ?? "-"}</p>
                <p className="text-textSecondary">Diet type: {context?.constraints.diet_type ?? "-"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Meal Plan</h4>
              <button
                type="button"
                onClick={() => void runRegenerate()}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {actionLoading === "regenerate" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
              </button>
            </div>

            <div className="mt-3 space-y-4">
              {mealGroups.map(([mealTime, items]) => (
                <div key={mealTime} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-textSecondary">{mealTime}</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <article key={item.recipe_id} className="rounded border border-border bg-surface p-3">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-textSecondary">{item.quantity.value} {item.quantity.unit}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void runReplace(item.recipe_id)}
                            disabled={actionsDisabled}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {actionLoading === "replace" && activeRecipeId === item.recipe_id ? "Replacing..." : "Replace"}
                          </button>
                          <button type="button" onClick={() => setShowExplain(true)} disabled={actionsDisabled} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50">Explain</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 xl:col-span-1">
            <h4 className="text-base font-semibold">System Insights</h4>
            <div className="mt-3 space-y-3 text-sm">
              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Confidence</p>
                <p className="text-textSecondary">{confidencePercent(data.confidence.value)} ({data.confidence.level})</p>
                <p className="text-textSecondary">Final score: {scoreValue.toFixed(3)}</p>
              </div>

              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Why this plan was generated</p>
                <p className="text-textSecondary">{data.explanation.deterministic}</p>
                {insights.length > 0 ? <p className="mt-1 text-textSecondary">{insights[0]}</p> : null}
              </div>

              <div className="border-b border-border/60 pb-2">
                <p className="font-medium">Warnings</p>
                {warnings.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-textSecondary">
                    {warnings.map((warning: string) => <li key={warning} className="flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5" /> <span>{warning}</span></li>)}
                  </ul>
                ) : (
                  <p className="text-textSecondary">No warnings reported.</p>
                )}
              </div>

              <div>
                <p className="font-medium">Diversity insights</p>
                <p className="text-textSecondary">{diversityInsight}</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => navigate("/system/trace")} className="inline-flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                  <GitBranch size={12} /> View System Trace
                </button>
                <button type="button" onClick={() => void runRegenerate()} disabled={actionsDisabled} className="inline-flex items-center gap-2 rounded border border-border px-2 py-1 text-xs disabled:opacity-50">
                  <Sparkles size={12} /> Re-run Analysis
                </button>
              </div>
            </div>
          </section>
        </div>

        {showExplain ? (
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold">Explanation View</h5>
              <button type="button" onClick={() => setShowExplain(false)} className="rounded border border-border px-2 py-1 text-xs">Close</button>
            </div>
            <p className="mt-2 text-sm text-textSecondary">{data.explanation.deterministic}</p>
            {data.explanation.ai_explanation ? <p className="mt-2 text-sm text-textSecondary">{data.explanation.ai_explanation}</p> : null}
            <p className="mt-2 text-xs text-textSecondary">trace_id: {data.trace_id}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}


