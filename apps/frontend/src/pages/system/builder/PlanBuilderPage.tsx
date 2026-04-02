import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Loader2, Send } from "lucide-react";
import { usePlanStore } from "@/state/plan.store";
import { validateDecisionRequest } from "@/services/validation/request.validator";
import {
  buildDecisionRequest,
  createInitialPlanBuilderFormState,
  type PlanBuilderFormState,
} from "@/services/requestBuilder";

const GOAL_OPTIONS = ["GOAL_MAINTENANCE", "GOAL_WEIGHT_LOSS", "GOAL_GLUCOSE_CONTROL"] as const;
const RISK_FLAG_OPTIONS = ["RISK_HIGH_GI", "RISK_INFLAMMATION", "RISK_DIGESTIVE"] as const;
const SYMPTOM_OPTIONS = ["bloating", "fatigue", "acidity", "constipation"] as const;
const ALLERGY_OPTIONS = ["peanut", "dairy", "soy", "gluten"] as const;
const PREFERENCE_OPTIONS = ["prefer_light", "prefer_warm", "prefer_low_spice"] as const;

function FieldLabel({ label }: { label: string }) {
  return <label className="mb-1 block text-xs font-medium text-textSecondary">{label}</label>;
}

function toggleArrayValue(values: string[], item: string): string[] {
  return values.includes(item) ? values.filter((entry) => entry !== item) : [...values, item];
}

function MultiSelectChecks({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            className="h-3.5 w-3.5"
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export function PlanBuilderPage() {
  const { requestDraft, setRequestDraft, runPlan, loading, error } = usePlanStore();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const [formState, setFormState] = useState<PlanBuilderFormState>(createInitialPlanBuilderFormState());
  const [identity] = useState({
    request_id: requestDraft.request_id,
    trace_id: requestDraft.trace_id,
  });

  const request = useMemo(() => buildDecisionRequest(formState, identity), [formState, identity]);
  const validation = useMemo(() => validateDecisionRequest(request), [request]);

  useEffect(() => {
    setRequestDraft(request);
  }, [request, setRequestDraft]);

  const enumValid = useMemo(() => {
    const { meal_type, season } = request.user_state.context;
    const { diet_type } = request.constraints;

    return ["breakfast", "lunch", "dinner"].includes(meal_type)
      && ["summer", "winter", "monsoon"].includes(season)
      && ["vegetarian", "vegan"].includes(diet_type);
  }, [request]);

  const boundsValid = useMemo(() => {
    const dosha = request.user_state.dosha_estimate;
    const sum = dosha.vata + dosha.pitta + dosha.kapha;

    return request.constraints.max_calories >= 0
      && dosha.vata >= 0 && dosha.vata <= 1
      && dosha.pitta >= 0 && dosha.pitta <= 1
      && dosha.kapha >= 0 && dosha.kapha <= 1
      && Math.abs(sum - 1) <= 0.03;
  }, [request]);

  const schemaValid = validation.success;
  const canSubmit = schemaValid && enumValid && boundsValid && !loading;

  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);

  function patchForm(updater: (current: PlanBuilderFormState) => PlanBuilderFormState) {
    setFormState((current) => updater(current));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setRequestDraft(request);
    await runPlan();
  }

  async function onCopyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const errorTraceId =
    typeof error?.error?.details?.trace_id === "string" ? error.error.details.trace_id : undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xl font-semibold">Plan Builder</h3>
        <p className="mt-1 text-sm text-textSecondary">DecisionRequest_v1 constructor with strict boundary checks</p>
        <p className="mt-2 font-mono text-xs text-muted">request_id: {request.request_id}</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">User State</h4>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <FieldLabel label="user_id" />
            <input
              value={formState.user_id}
              onChange={(e) => patchForm((curr) => ({ ...curr, user_id: e.target.value }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div>
            <FieldLabel label="meal_type" />
            <select
              value={formState.meal_type}
              onChange={(e) => patchForm((curr) => ({
                ...curr,
                meal_type: e.target.value as PlanBuilderFormState["meal_type"],
              }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
            </select>
          </div>

          <div>
            <FieldLabel label="season" />
            <select
              value={formState.season}
              onChange={(e) => patchForm((curr) => ({
                ...curr,
                season: e.target.value as PlanBuilderFormState["season"],
              }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="summer">summer</option>
              <option value="winter">winter</option>
              <option value="monsoon">monsoon</option>
            </select>
          </div>

          <div>
            <FieldLabel label="dosha_estimate (vata/pitta/kapha)" />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={formState.dosha_estimate.vata}
                onChange={(e) => patchForm((curr) => ({
                  ...curr,
                  dosha_estimate: {
                    ...curr.dosha_estimate,
                    vata: Number(e.target.value),
                  },
                }))}
                className="rounded border border-border bg-surface px-2 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={formState.dosha_estimate.pitta}
                onChange={(e) => patchForm((curr) => ({
                  ...curr,
                  dosha_estimate: {
                    ...curr.dosha_estimate,
                    pitta: Number(e.target.value),
                  },
                }))}
                className="rounded border border-border bg-surface px-2 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={formState.dosha_estimate.kapha}
                onChange={(e) => patchForm((curr) => ({
                  ...curr,
                  dosha_estimate: {
                    ...curr.dosha_estimate,
                    kapha: Number(e.target.value),
                  },
                }))}
                className="rounded border border-border bg-surface px-2 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel label="goals" />
            <MultiSelectChecks
              options={GOAL_OPTIONS}
              selected={formState.goals}
              onToggle={(value) => patchForm((curr) => ({ ...curr, goals: toggleArrayValue(curr.goals, value) }))}
            />
          </div>

          <div>
            <FieldLabel label="risk_flags" />
            <MultiSelectChecks
              options={RISK_FLAG_OPTIONS}
              selected={formState.risk_flags}
              onToggle={(value) => patchForm((curr) => ({ ...curr, risk_flags: toggleArrayValue(curr.risk_flags, value) }))}
            />
          </div>

          <div>
            <FieldLabel label="symptoms" />
            <MultiSelectChecks
              options={SYMPTOM_OPTIONS}
              selected={formState.symptoms}
              onToggle={(value) => patchForm((curr) => ({ ...curr, symptoms: toggleArrayValue(curr.symptoms, value) }))}
            />
          </div>

          <div>
            <FieldLabel label="allergies" />
            <MultiSelectChecks
              options={ALLERGY_OPTIONS}
              selected={formState.allergies}
              onToggle={(value) => patchForm((curr) => ({ ...curr, allergies: toggleArrayValue(curr.allergies, value) }))}
            />
          </div>

          <div>
            <FieldLabel label="preferences" />
            <MultiSelectChecks
              options={PREFERENCE_OPTIONS}
              selected={formState.preferences}
              onToggle={(value) => patchForm((curr) => ({ ...curr, preferences: toggleArrayValue(curr.preferences, value) }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Constraints</h4>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <FieldLabel label="max_calories" />
            <input
              type="number"
              min={0}
              step={1}
              value={formState.max_calories}
              onChange={(e) => patchForm((curr) => ({ ...curr, max_calories: Number(e.target.value) }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div>
            <FieldLabel label="diet_type" />
            <select
              value={formState.diet_type}
              onChange={(e) => patchForm((curr) => ({
                ...curr,
                diet_type: e.target.value as PlanBuilderFormState["diet_type"],
              }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="vegetarian">vegetarian</option>
              <option value="vegan">vegan</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Meta</h4>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <FieldLabel label="request_source" />
            <input
              value={formState.request_source}
              onChange={(e) => patchForm((curr) => ({ ...curr, request_source: e.target.value }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div>
            <FieldLabel label="cache_allowed" />
            <label className="flex h-[42px] items-center gap-2 rounded border border-border bg-surface px-3 text-sm">
              <input
                type="checkbox"
                checked={formState.cache_allowed}
                onChange={(e) => patchForm((curr) => ({ ...curr, cache_allowed: e.target.checked }))}
              />
              <span>{formState.cache_allowed ? "enabled" : "disabled"}</span>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Validation Panel</h4>
        <div className="mt-3 space-y-1 text-sm">
          <p className={schemaValid ? "text-success" : "text-error"}>{schemaValid ? "PASS" : "FAIL"} Schema valid</p>
          <p className={enumValid ? "text-success" : "text-error"}>{enumValid ? "PASS" : "FAIL"} Enums valid</p>
          <p className={boundsValid ? "text-success" : "text-error"}>{boundsValid ? "PASS" : "FAIL"} Bounds valid</p>
        </div>

        {issues.length > 0 ? (
          <div className="mt-3 rounded border border-error/50 bg-error/10 p-3 text-xs text-error">
            {issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">JSON Preview</h4>
          <button
            type="button"
            onClick={onCopyJson}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-textSecondary"
          >
            <ClipboardCopy size={14} /> Copy
          </button>
        </div>

        {copyState !== "idle" ? (
          <p className={`mt-2 text-xs ${copyState === "copied" ? "text-success" : "text-error"}`}>
            {copyState === "copied" ? "JSON copied" : "Failed to copy"}
          </p>
        ) : null}

        <pre className="mt-3 max-h-[360px] overflow-auto rounded border border-border bg-surface p-3 font-mono text-xs">
          {JSON.stringify(request, null, 2)}
        </pre>
      </section>

      {error ? (
        <section className="rounded-lg border border-error/50 bg-error/10 p-4 text-sm text-error">
          <p className="font-semibold">API Error</p>
          <p className="mt-1">{error.error.code}: {error.error.message}</p>
          {errorTraceId ? <p className="mt-1 font-mono text-xs">trace_id: {errorTraceId}</p> : null}
        </section>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded border border-accent bg-accent/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? "Submitting..." : "Submit DecisionRequest_v1"}
        </button>
      </div>
    </form>
  );
}
