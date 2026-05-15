import type { ReactNode } from "react";
import type { DecisionRequestV1 } from "@/contracts/DecisionRequestV1";
import type { PlannerMealPreference, PlannerPlanType } from "@/store/plan.store";

export type PlanType = PlannerPlanType;
export type MealPreference = PlannerMealPreference;

export type PlannerConfigProps = {
  loading: boolean;
  error: string | null;
  planType: PlanType;
  calorieTarget: number | null;
  exclusionInput: string;
  dietaryExclusions: string[];
  mealPreference: MealPreference;
  mealType: DecisionRequestV1["user_state"]["context"]["meal_type"] | null;
  dietType: DecisionRequestV1["constraints"]["diet_type"] | null;
  season: DecisionRequestV1["user_state"]["context"]["season"];
  goal: string | null;
  prakriti: { vata: number; pitta: number; kapha: number };
  modeHint: string | null;
  onSetPlanType: (value: PlanType) => void;
  onSetCalorieTarget: (value: number | null) => void;
  onSetExclusionInput: (value: string) => void;
  onAddExclusion: () => void;
  onRemoveExclusion: (value: string) => void;
  onSetMealPreference: (value: MealPreference) => void;
  onSetMealType: (value: DecisionRequestV1["user_state"]["context"]["meal_type"] | null) => void;
  onSetDietType: (value: DecisionRequestV1["constraints"]["diet_type"] | null) => void;
  onGenerate: () => void;
  onEditContext: () => void;
};

const PLAN_TYPE_OPTIONS: Array<{ key: PlanType; label: string; icon: string; description: string }> = [
  { key: "single_meal", label: "Single Meal", icon: "SM", description: "Runs real /plan single-meal generation." },
  { key: "full_day", label: "Full Day", icon: "FD", description: "Generates breakfast, lunch, dinner via deterministic orchestration." },
  { key: "weekly", label: "Weekly", icon: "WK", description: "Runs deterministic weekly orchestration via /plan/weekly." },
];

const MEAL_PREF_OPTIONS: Array<{ key: MealPreference; label: string; description: string }> = [
  { key: "light", label: "Light", description: "Easy digesting" },
  { key: "balanced", label: "Balanced", description: "General purpose" },
  { key: "high_energy", label: "High Energy", description: "Performance-oriented" },
];

const MEAL_TYPE_OPTIONS: DecisionRequestV1["user_state"]["context"]["meal_type"][] = ["breakfast", "lunch", "dinner"];

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}

function StepCard(props: { title: string; step: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E3D7C3] bg-white/85 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#7A6F4B] text-xs font-semibold text-white">
          {props.step}
        </span>
        <p className="text-sm font-semibold tracking-wide text-[#2F2F2F]">{props.title}</p>
      </div>
      {props.children}
    </section>
  );
}

export function PlannerConfigView(props: PlannerConfigProps) {
  const isSingleMeal = props.planType === "single_meal";

  return (
    <article className="rounded-3xl border border-[#E6D9C6] bg-[linear-gradient(145deg,#fbf8f2_0%,#f3ebdf_100%)] p-6 shadow-[0_12px_32px_rgba(80,58,20,0.08)] transition-all duration-300">
      {props.error && (
        <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-[fadeIn_.2s_ease-out]">
          <p>{props.error}</p>
        </div>
      )}

      {props.modeHint && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-[fadeIn_.2s_ease-out]">
          {props.modeHint}
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.18em] text-[#8E7A56]">Guided Planner</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#2F2F2F]">Build A Valid Plan Request</h2>
      <p className="mt-2 text-sm text-[#675A43]">Step-by-step configuration aligned to deterministic backend contracts.</p>

      <div className="mt-6 space-y-4">
        <StepCard step={1} title="Plan Type">
          <div className="grid gap-3 md:grid-cols-3">
            {PLAN_TYPE_OPTIONS.map((option) => {
              const active = props.planType === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => props.onSetPlanType(option.key)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-250 ${
                    active
                      ? "border-[#7A6F4B] bg-[#fffdf8] shadow-[0_6px_18px_rgba(122,111,75,0.25)]"
                      : "border-[#E6D9C6] bg-white hover:border-[#b8a070]"
                  }`}
                >
                  <p className="text-base font-semibold text-[#2F2F2F]">{option.icon} {option.label}</p>
                  <p className="mt-1 text-xs text-[#6E624D]">{option.description}</p>
                </button>
              );
            })}
          </div>
        </StepCard>

        <StepCard step={2} title="Goal Inputs">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#2F2F2F]">Calories</p>
                <span className="rounded-full border border-[#DCCDB2] bg-white px-3 py-1 text-xs font-semibold text-[#2F2F2F]">
                  {props.calorieTarget ?? "-"}{props.calorieTarget ? " kcal" : ""}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={4000}
                step={50}
                value={props.calorieTarget ?? 0}
                onChange={(e) => props.onSetCalorieTarget(Number(e.target.value))}
                className="mt-2 w-full accent-[#7A6F4B]"
              />
              <input
                type="number"
                min={1}
                value={props.calorieTarget ?? ""}
                onChange={(e) => {
                  if (e.target.value.trim() === "") {
                    props.onSetCalorieTarget(null);
                    return;
                  }
                  const parsed = Number(e.target.value);
                  props.onSetCalorieTarget(Number.isFinite(parsed) ? parsed : null);
                }}
                className="mt-2 w-44 rounded-xl border border-[#d1c2a7] bg-white px-3 py-2 text-sm text-[#2F2F2F]"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[#2F2F2F]">Meal Preference</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MEAL_PREF_OPTIONS.map((option) => {
                  const active = props.mealPreference === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => props.onSetMealPreference(option.key)}
                      className={`rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${
                        active
                          ? "border-[#7A6F4B] bg-[#fffdf8] text-[#2F2F2F]"
                          : "border-[#E6D9C6] bg-white text-[#5f5542] hover:border-[#b8a070]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`transition-all duration-300 ${isSingleMeal ? "opacity-100" : "opacity-40"}`}>
                <p className="text-sm font-medium text-[#2F2F2F]">Meal Type</p>
                <select
                  value={props.mealType ?? ""}
                  onChange={(e) => props.onSetMealType(e.target.value === "" ? null : (e.target.value as DecisionRequestV1["user_state"]["context"]["meal_type"]))}
                  disabled={!isSingleMeal}
                  className="mt-2 w-full rounded-xl border border-[#d1c2a7] bg-white px-3 py-2 text-sm text-[#2F2F2F] disabled:cursor-not-allowed"
                >
                  <option value="">Select meal type</option>
                  {MEAL_TYPE_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-sm font-medium text-[#2F2F2F]">Diet Type</p>
                <select
                  value={props.dietType ?? ""}
                  onChange={(e) => props.onSetDietType(e.target.value === "" ? null : (e.target.value as DecisionRequestV1["constraints"]["diet_type"]))}
                  className="mt-2 w-full rounded-xl border border-[#d1c2a7] bg-white px-3 py-2 text-sm text-[#2F2F2F]"
                >
                  <option value="">Select diet type</option>
                  <option value="vegetarian">vegetarian</option>
                  <option value="vegan">vegan</option>
                </select>
              </div>
            </div>
          </div>
        </StepCard>

        <StepCard step={3} title="Exclusions">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={props.exclusionInput}
                onChange={(e) => props.onSetExclusionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    props.onAddExclusion();
                  }
                }}
                className="w-full rounded-xl border border-[#d1c2a7] bg-white px-3 py-2 text-sm text-[#2F2F2F]"
                placeholder="Add exclusion and press Enter"
              />
              <button
                type="button"
                onClick={props.onAddExclusion}
                className="rounded-xl border border-[#b9a989] bg-white px-4 py-2 text-sm font-medium text-[#5a503c] transition hover:bg-[#f4ecde]"
              >
                Add
              </button>
            </div>
            <div className="flex min-h-8 flex-wrap gap-2">
              {props.dietaryExclusions.length === 0 ? <span className="text-xs text-[#7c705a]">No exclusions added.</span> : null}
              {props.dietaryExclusions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => props.onRemoveExclusion(item)}
                  className="rounded-full border border-[#d9c7a9] bg-white px-3 py-1 text-xs font-medium text-[#4e4534] transition hover:bg-[#f7f1e8]"
                >
                  {item} x
                </button>
              ))}
            </div>
          </div>
        </StepCard>

        <StepCard step={4} title="Context (Read-only)">
          <div className="grid gap-2 text-sm text-[#5c523f] sm:grid-cols-2">
            <p><span className="font-medium text-[#2F2F2F]">Prakriti:</span> V {props.prakriti.vata.toFixed(2)} / P {props.prakriti.pitta.toFixed(2)} / K {props.prakriti.kapha.toFixed(2)}</p>
            <p><span className="font-medium text-[#2F2F2F]">Goal:</span> {props.goal ?? "-"}</p>
            <p><span className="font-medium text-[#2F2F2F]">Diet Type:</span> {props.dietType ?? "-"}</p>
            <p><span className="font-medium text-[#2F2F2F]">Season:</span> {props.season}</p>
          </div>
          <button
            type="button"
            onClick={props.onEditContext}
            className="mt-3 rounded-xl border border-[#b9a989] bg-white px-4 py-2 text-sm font-medium text-[#5a503c] transition hover:bg-[#f4ecde]"
          >
            Edit
          </button>
        </StepCard>

        <StepCard step={5} title="Generate">
          <button
            type="button"
            onClick={props.onGenerate}
            disabled={props.loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7A6F4B] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#6b6146] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.loading ? <><Spinner /> Generating...</> : "Generate Plan"}
          </button>
        </StepCard>
      </div>
    </article>
  );
}





