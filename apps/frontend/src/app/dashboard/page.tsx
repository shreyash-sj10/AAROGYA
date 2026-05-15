import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContractValidationError } from "@/services/api/apiClient";
import { generatePlan } from "@/services/api/plan.api";
import { dashboardTelemetryApi, type DashboardTelemetry } from "@/services/api/observability.api";
import { buildDecisionRequestFromUserContext, sanitizeList } from "@/services/mappers/buildDecisionRequestFromUserContext";
import { usePlanStore } from "@/store/plan.store";
import { useUserContextStore } from "@/store/userContext.store";
import { useAuthStore } from "@/store/auth.store";
import { useHealthStore } from "@/store/health.store";
import { EngineeringPageHeader } from "@/components/ui/EngineeringPageHeader";
import { MetricTile } from "@/components/ui/MetricTile";
import { StatusPill } from "@/components/ui/StatusPill";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { OpsQuickLinks } from "@/components/dashboard/OpsQuickLinks";

function mapErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("diet_type") || normalized.includes("diet type")) return "Please select diet type.";
  if (normalized.includes("meal_type") || normalized.includes("meal type")) return "Please choose meal type.";
  if (normalized.includes("calorie") || normalized.includes("max_calories")) return "Please provide a valid calorie target.";
  if (normalized.includes("no valid") || normalized.includes("no candidates") || normalized.includes("constraints")) {
    return "No valid plan found under constraints.";
  }
  return "Unable to complete request right now.";
}

function toPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function scoreToTone(score: number): string {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Moderate";
  return "Needs attention";
}

function toTitle(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function trendToBars(points: Array<{ timestamp: number; value: number }>, percentScale = true): number[] {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }

  return points.slice(-5).map((point) => {
    const value = percentScale ? point.value * 100 : point.value;
    return Math.max(0, Math.min(100, Math.round(value)));
  });
}

const dashboardTelemetryDisabled = import.meta.env.VITE_DISABLE_DASHBOARD_TELEMETRY === "true";

export default function DashboardPage() {
  const navigate = useNavigate();
  const userContext = useUserContextStore((s) => s.userContext);
  const authUser = useAuthStore((s) => s.user);
  const plan = usePlanStore((s) => s.plan);
  const plannerInputs = usePlanStore((s) => s.plannerInputs);
  const setPlan = usePlanStore((s) => s.setPlan);
  const planHistory = usePlanStore((s) => s.planHistory);

  const hasPlan = Boolean(plan && Array.isArray(plan.meal_plan) && plan.meal_plan.length > 0);

  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<DashboardTelemetry | null>(null);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const scorePercent = hasPlan && plan ? toPercent(plan.score) : 0;
  const confidencePercent = hasPlan && plan ? toPercent(plan.confidence.value) : 0;

  const topWarnings = hasPlan && plan ? plan.warnings.slice(0, 2) : [];
  const topInsights = hasPlan && plan ? plan.insights.slice(0, 2) : [];
  const meals = hasPlan && plan ? plan.meal_plan : [];

  const mealSlots = useMemo(() => {
    if (!hasPlan || !plan) return [] as Array<{ label: string; name: string }>;

    if (plannerInputs.plan_type === "single_meal") {
      const selected = plannerInputs.meal_type ? toTitle(plannerInputs.meal_type) : "Meal";
      return meals.map((meal, index) => ({
        label: index === 0 ? selected : `Extra Meal ${index + 1}`,
        name: meal.name,
      }));
    }

    const daySlots = ["Breakfast", "Lunch", "Dinner"];
    return meals.map((meal, index) => ({
      label: daySlots[index] ?? `Meal ${index + 1}`,
      name: meal.name,
    }));
  }, [hasPlan, plan, plannerInputs.plan_type, plannerInputs.meal_type, meals]);

  const adherenceStats = useMemo(() => {
    if (!telemetry || telemetry.adherence_history.length === 0) {
      return null;
    }
    return telemetry.adherence_history[0]?.stats ?? null;
  }, [telemetry]);

  const adherenceRows = mealSlots.map((slot, index) => {
    const followed = Number(adherenceStats?.meals_followed || 0);
    const skipped = Number(adherenceStats?.meals_skipped || 0);
    const modified = Number(adherenceStats?.meals_modified || 0);
    const mark = index < followed ? "F" : index < followed + modified ? "M" : index < followed + modified + skipped ? "S" : "P";
    const label = mark === "F" ? "Followed" : mark === "M" ? "Modified" : mark === "S" ? "Skipped" : "Planned";

    return {
      slot: slot.label,
      label,
      mark,
    };
  });

  const readiness = useMemo(() => {
    const checks = [
      Boolean(userContext.prakriti),
      Boolean(userContext.goals),
      Boolean(plannerInputs.diet_type),
      Boolean(plannerInputs.calorie_limit && plannerInputs.calorie_limit > 0),
      hasPlan,
    ];
    const passed = checks.filter(Boolean).length;
    const pct = Math.round((passed / checks.length) * 100);
    if (pct >= 80) return { pct, label: "Ready" };
    if (pct >= 50) return { pct, label: "Partial" };
    return { pct, label: "Setup needed" };
  }, [userContext.prakriti, userContext.goals, plannerInputs.diet_type, plannerInputs.calorie_limit, hasPlan]);
  const scoreTrendBars = trendToBars(telemetry?.score_trend ?? []);
  const confidenceTrendBars = trendToBars(telemetry?.confidence_trend ?? []);
  const fallbackTrendBars = trendToBars(telemetry?.fallback_rate_trend ?? []);

  const health = useHealthStore((s) => s.data);
  const healthLoading = useHealthStore((s) => s.loading);
  const fetchHealth = useHealthStore((s) => s.fetch);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    let cancelled = false;

    if (dashboardTelemetryDisabled) {
      setTelemetry(null);
      setTelemetryError(null);
      return;
    }

    const userId = authUser?.id;
    if (!userId) {
      setTelemetry(null);
      setTelemetryError(null);
      return;
    }

    void (async () => {
      setTelemetryError(null);
      const result = await dashboardTelemetryApi({ user_id: userId, trend_limit: 5 });
      if (cancelled) {
        return;
      }

      if (result.error || !result.data) {
        setTelemetry(null);
        const msg = result.error?.error?.message ?? "Unable to load telemetry.";
        setTelemetryError(msg);
        return;
      }

      setTelemetry(result.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, plan?.request_id, dashboardTelemetryDisabled]);
  const handleRegenerate = async () => {
    if (!plan || regenerating) return;
    setError(null);

    if (plannerInputs.plan_type !== "single_meal") {
      setError("Regeneration from Dashboard currently supports Single Meal plans.");
      return;
    }

    if (!plannerInputs.meal_type || !plannerInputs.diet_type || !plannerInputs.season || !plannerInputs.calorie_limit || plannerInputs.calorie_limit <= 0) {
      setError("Planner inputs missing. Please regenerate from Planner.");
      return;
    }

    setRegenerating(true);
    try {
      const request = buildDecisionRequestFromUserContext(userContext, {
        meal_type: plannerInputs.meal_type,
        season: plannerInputs.season,
        calorie_limit: plannerInputs.calorie_limit,
        diet_type: plannerInputs.diet_type,
        exclusions: sanitizeList(plannerInputs.exclusions),
        preferences: plannerInputs.preferences,
        meal_preference: plannerInputs.meal_preference ?? "balanced",
      });

      const response = await generatePlan(request);
      if (response.error || !response.data) {
        throw new Error(response.error?.error?.message || "Unable to process request. Please try a more specific question.");
      }

      setPlan(response.data, request);
    } catch (err) {
      const message = err instanceof ContractValidationError || err instanceof Error ? err.message : "Plan generation failed.";
      setError(mapErrorMessage(message));
    } finally {
      setRegenerating(false);
    }
  };

  const healthTone = health?.status === "ok" ? "ok" : health ? "warn" : "neutral";

  return (
    <section className="space-y-6 ui-fade-in">
      <EngineeringPageHeader
        title="Operations dashboard"
        description="Health probes, pipeline telemetry, and your latest deterministic plan."
        meta={
          <>
            <StatusPill
              label={healthLoading ? "Health…" : health?.status === "ok" ? "Health OK" : "Health degraded"}
              tone={healthTone}
            />
            {hasPlan && plan ? (
              <StatusPill label={`Score ${scorePercent}%`} tone={scorePercent >= 70 ? "ok" : "warn"} />
            ) : (
              <StatusPill label="No plan in session" tone="neutral" />
            )}
          </>
        }
        actions={
          <button type="button" onClick={() => navigate("/app/planner")} className="eng-btn-primary">
            Open planner
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="API health"
          value={healthLoading ? "…" : health?.status ?? "—"}
          hint={
            health
              ? `DB ${health.checks.db.ok ? "up" : "down"} · Redis ${health.checks.redis.ok ? "up" : "down"} · AI ${health.checks.ai.ok ? "up" : "down"}`
              : "GET /health"
          }
        />
        <MetricTile
          label="Plan confidence"
          value={hasPlan && plan ? `${confidencePercent}%` : "—"}
          hint={hasPlan && plan ? plan.confidence.level : "Generate a plan"}
        />
        <MetricTile
          label="Fallback rate"
          value={telemetry ? `${Math.round(telemetry.fallback_rate * 100)}%` : "—"}
          hint="User telemetry window"
        />
        <MetricTile label="Readiness" value={`${readiness.pct}%`} hint={readiness.label} />
      </div>

      <OpsQuickLinks />

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      {telemetryError ? <AlertBanner tone="warn">{telemetryError}</AlertBanner> : null}

      {!hasPlan ? (
        <article className="eng-panel p-6 ui-fade-in-delay">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Planner</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">No plan in session</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            Run the deterministic pipeline from Planner. Trace and observability views activate after the first successful response.
          </p>
          <button type="button" onClick={() => navigate("/app/planner")} className="eng-btn-primary mt-4">
            Generate plan
          </button>
        </article>
      ) : (
        <div className="grid gap-6">

          <main className="space-y-5">
            <article className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm ui-elevate ui-fade-in">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gray-400">Today Plan</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#2F2F2F]">Meals Quick View</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/app/planner")}
                    className="rounded-xl border border-[#d6c7ac] bg-white px-3 py-2 text-xs font-semibold text-[#4e4534] transition hover:bg-[#f8f2e7]"
                  >
                    View Full Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleRegenerate(); }}
                    disabled={regenerating}
                    className="rounded-xl bg-[#7A6F4B] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6b6146] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {regenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {mealSlots.map((slot) => (
                  <div key={`${slot.label}-${slot.name}`} className="rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-3">
                    <p className="text-xs uppercase tracking-wide text-[#8E7A56]">{slot.label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#2F2F2F]">{slot.name || "-"}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm ui-elevate ui-fade-in-delay">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-400">Progress Tracker</p>
              <h3 className="mt-1 text-lg font-semibold text-[#2F2F2F]">Daily Adherence</h3>

              <div className="mt-3 space-y-2 text-sm text-[#2F2F2F]">
                {adherenceRows.map((row) => (
                  <div key={row.slot} className="flex items-center justify-between rounded-xl border border-[#eee5d5] bg-[#faf7f1] px-3 py-2">
                    <span>{row.slot}</span>
                    <span className={`text-xs font-semibold ${row.mark === "F" ? "text-emerald-700" : row.mark === "S" ? "text-rose-700" : "text-amber-700"}`}>
                      {row.mark} {row.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#8E7A56]">Score Trend</p>
                  <div className="mt-2 flex items-end gap-1 h-12">
                    {scoreTrendBars.length > 0 ? scoreTrendBars.map((bar, idx) => (
                      <div key={`score-${idx}`} className="w-4 rounded-t bg-[#7A6F4B]" style={{ height: `${Math.max(10, bar)}%` }} />
                    )) : <p className="text-xs text-[#675A43]">No history yet</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#8E7A56]">Confidence Trend</p>
                  <div className="mt-2 flex items-end gap-1 h-12">
                    {confidenceTrendBars.length > 0 ? confidenceTrendBars.map((bar, idx) => (
                      <div key={`conf-${idx}`} className="w-4 rounded-t bg-[#7f8f5f]" style={{ height: `${Math.max(10, bar)}%` }} />
                    )) : <p className="text-xs text-[#675A43]">No history yet</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#8E7A56]">Fallback Rate</p>
                  <div className="mt-2 flex items-end gap-1 h-12">
                    {fallbackTrendBars.length > 0 ? fallbackTrendBars.map((bar, idx) => (
                      <div key={`fb-${idx}`} className="w-4 rounded-t bg-[#c4835a]" style={{ height: `${Math.max(6, bar)}%` }} />
                    )) : <p className="text-xs text-[#675A43]">No history yet</p>}
                  </div>
                </div>
              </div>
            </article>
          </main>
        </div>
      )}
    </section>
  );
}









