import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Loader2, Send } from "lucide-react";
import { usePlanStore } from "@/state/plan.store";
import { validateDecisionRequest } from "@/services/validation/request.validator";
import { estimatePrakriti } from "@/services/api/prakriti.api";
import {
  buildDecisionRequest,
  createInitialPlanBuilderFormState,
  type PlanBuilderFormState,
} from "@/services/requestBuilder";

const GOAL_OPTIONS = ["GOAL_MAINTENANCE", "GOAL_WEIGHT_LOSS", "GOAL_GLUCOSE_CONTROL"] as const;
const HEALTH_OPTIONS = [
  { label: "Diabetes", value: "RISK_DIABETES" },
  { label: "Acidity", value: "RISK_ACIDITY" },
  { label: "PCOS", value: "RISK_PCOS" },
  { label: "Hypertension", value: "RISK_HYPERTENSION" },
  { label: "Thyroid", value: "RISK_THYROID" },
] as const;
const ALLERGY_OPTIONS = ["peanut", "dairy", "soy", "gluten"] as const;
const PREFERENCE_OPTIONS = ["prefer_light", "prefer_warm", "prefer_low_spice"] as const;
const GENDER_OPTIONS = ["male", "female", "other"] as const;

type PrakritiAnswerValue =
  | "thin" | "medium" | "heavy"
  | "dry" | "warm_oily" | "thick_cool"
  | "irregular" | "strong" | "slow"
  | "variable" | "intense" | "stable"
  | "anxious" | "irritable" | "calm"
  | "light" | "moderate" | "deep"
  | "warm" | "cool"
  | "bloated" | "acidic" | "sluggish"
  | "inconsistent" | "steady"
  | "lose" | "gain";

type PrakritiQuestion = {
  id: "body_build" | "skin" | "appetite" | "energy" | "nature" | "sleep" | "climate" | "food_response" | "work_style" | "weight";
  label: string;
  options: Array<{ label: string; value: PrakritiAnswerValue }>;
};

const PRAKRITI_QUESTIONS: PrakritiQuestion[] = [
  { id: "body_build", label: "Q1. Body build", options: [{ label: "thin", value: "thin" }, { label: "medium", value: "medium" }, { label: "heavy", value: "heavy" }] },
  { id: "skin", label: "Q2. Skin", options: [{ label: "dry", value: "dry" }, { label: "warm/oily", value: "warm_oily" }, { label: "thick/cool", value: "thick_cool" }] },
  { id: "appetite", label: "Q3. Appetite", options: [{ label: "irregular", value: "irregular" }, { label: "strong", value: "strong" }, { label: "slow", value: "slow" }] },
  { id: "energy", label: "Q4. Energy", options: [{ label: "variable", value: "variable" }, { label: "intense", value: "intense" }, { label: "stable", value: "stable" }] },
  { id: "nature", label: "Q5. Nature", options: [{ label: "anxious", value: "anxious" }, { label: "irritable", value: "irritable" }, { label: "calm", value: "calm" }] },
  { id: "sleep", label: "Q6. Sleep", options: [{ label: "light", value: "light" }, { label: "moderate", value: "moderate" }, { label: "deep", value: "deep" }] },
  { id: "climate", label: "Q7. Climate preference", options: [{ label: "warm", value: "warm" }, { label: "cool", value: "cool" }, { label: "dry", value: "dry" }] },
  { id: "food_response", label: "Q8. After heavy food", options: [{ label: "bloated", value: "bloated" }, { label: "acidic", value: "acidic" }, { label: "sluggish", value: "sluggish" }] },
  { id: "work_style", label: "Q9. Work style", options: [{ label: "inconsistent", value: "inconsistent" }, { label: "intense", value: "intense" }, { label: "steady", value: "steady" }] },
  { id: "weight", label: "Q10. Weight tendency", options: [{ label: "lose easily", value: "lose" }, { label: "stable", value: "stable" }, { label: "gain easily", value: "gain" }] },
];

type PrakritiQuestionId = (typeof PRAKRITI_QUESTIONS)[number]["id"];
type PrakritiAnswers = Partial<Record<PrakritiQuestionId, PrakritiAnswerValue>>;

function FieldLabel({ label }: { label: string }) {
  return <label className="mb-1 block text-xs font-medium text-textSecondary">{label}</label>;
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-textSecondary">{description}</p>
    </div>
  );
}

function toggleArrayValue(values: string[], item: string): string[] {
  return values.includes(item) ? values.filter((entry) => entry !== item) : [...values, item];
}

function parseTagInput(value: string): string[] {
  return value.split(/[,\n]/g).map((entry) => entry.trim()).filter(Boolean);
}

function numberToInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function MultiSelectChecks({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
          <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} className="h-3.5 w-3.5" />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function HealthChecks({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {HEALTH_OPTIONS.map((option) => (
        <label key={option.value} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
          <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} className="h-3.5 w-3.5" />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function DoshaBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 w-full rounded bg-surface">
        <div className="h-2 rounded bg-accent" style={{ width: `${Math.max(0, Math.min(value, 1)) * 100}%` }} />
      </div>
    </div>
  );
}

export function PlanBuilderPage() {
  const { requestDraft, setRequestDraft, runPlan, loading, error } = usePlanStore();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [showDebugView, setShowDebugView] = useState(false);
  const [prakritiLoading, setPrakritiLoading] = useState(false);
  const [prakritiError, setPrakritiError] = useState<string | null>(null);
  const prakritiRequestVersionRef = useRef(0);
  const prakritiAbortRef = useRef<AbortController | null>(null);

  const [formState, setFormState] = useState<PlanBuilderFormState>(createInitialPlanBuilderFormState());
  const [symptomInput, setSymptomInput] = useState("");
  const [prakritiAnswers, setPrakritiAnswers] = useState<PrakritiAnswers>({});
  const [identity] = useState({ request_id: requestDraft.request_id, trace_id: requestDraft.trace_id });

  const request = useMemo(() => buildDecisionRequest(formState, identity), [formState, identity]);
  const validation = useMemo(() => validateDecisionRequest(request), [request]);

  useEffect(() => { setRequestDraft(request); }, [request, setRequestDraft]);

  const symptomTags = useMemo(() => parseTagInput(symptomInput), [symptomInput]);
  const assessmentAnsweredCount = Object.keys(prakritiAnswers).length;
  const assessmentComplete = assessmentAnsweredCount === PRAKRITI_QUESTIONS.length;
  const hasPrakriti = formState.prakriti !== null;

  const enumValid = useMemo(() => {
    const { meal_type, season } = request.user_state.context;
    const { diet_type } = request.constraints;
    return ["breakfast", "lunch", "dinner"].includes(meal_type)
      && ["summer", "winter", "monsoon"].includes(season)
      && ["vegetarian", "vegan"].includes(diet_type);
  }, [request]);

  const boundsValid = useMemo(() => {
    if (!hasPrakriti) {
      return false;
    }
    const dosha = request.user_state.dosha_estimate;
    const sum = dosha.vata + dosha.pitta + dosha.kapha;
    return request.constraints.max_calories >= 0
      && dosha.vata >= 0 && dosha.vata <= 1
      && dosha.pitta >= 0 && dosha.pitta <= 1
      && dosha.kapha >= 0 && dosha.kapha <= 1
      && Math.abs(sum - 1) <= 0.03;
  }, [request, hasPrakriti]);

  const profileBoundsValid = useMemo(() => {
    const profile = formState.profile;
    return Number(profile.age) > 0 && Number(profile.height_cm) > 0 && Number(profile.weight_kg) > 0;
  }, [formState]);

  const schemaValid = validation.success;
  const canSubmit = schemaValid && enumValid && boundsValid && hasPrakriti && !loading;

  const issues = validation.success ? [] : validation.error.issues.map(() => "Please complete required fields");

  function patchForm(updater: (current: PlanBuilderFormState) => PlanBuilderFormState) {
    setFormState((current) => updater(current));
  }

  function invalidatePrakritiState() {
    prakritiRequestVersionRef.current += 1;
    prakritiAbortRef.current?.abort();
    prakritiAbortRef.current = null;
    setPrakritiLoading(false);
    patchForm((curr) => ({ ...curr, prakriti: null, prakriti_confidence: null }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasPrakriti) {
      setPrakritiError("Please calculate your Prakriti before generating plan");
      return;
    }
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

  async function onCalculatePrakriti() {
    if (!assessmentComplete || prakritiLoading) {
      return;
    }

    const answers = {
      body_build: prakritiAnswers.body_build,
      skin: prakritiAnswers.skin,
      appetite: prakritiAnswers.appetite,
      energy: prakritiAnswers.energy,
      nature: prakritiAnswers.nature,
      sleep: prakritiAnswers.sleep,
      climate: prakritiAnswers.climate,
      food_response: prakritiAnswers.food_response,
      work_style: prakritiAnswers.work_style,
      weight: prakritiAnswers.weight,
    };

    if (Object.values(answers).some((value) => typeof value !== "string" || !value)) {
      setPrakritiError("Please complete required fields");
      return;
    }
    const requestVersion = prakritiRequestVersionRef.current + 1;
    const requestAbortController = new AbortController();
    prakritiAbortRef.current?.abort();
    prakritiAbortRef.current = requestAbortController;
    prakritiRequestVersionRef.current = requestVersion;
    setPrakritiLoading(true);
    setPrakritiError(null);
    const result = await estimatePrakriti({
      answers: answers as {
        body_build: "thin" | "medium" | "heavy";
        skin: "dry" | "warm_oily" | "thick_cool";
        appetite: "irregular" | "strong" | "slow";
        energy: "variable" | "intense" | "stable";
        nature: "anxious" | "irritable" | "calm";
        sleep: "light" | "moderate" | "deep";
        climate: "warm" | "cool" | "dry";
        food_response: "bloated" | "acidic" | "sluggish";
        work_style: "inconsistent" | "intense" | "steady";
        weight: "lose" | "stable" | "gain";
      },
      symptoms: formState.symptoms,
    }, {
      signal: requestAbortController.signal,
      requestId: identity.request_id,
      traceId: identity.trace_id,
      requestVersion,
    });

    if (requestVersion !== prakritiRequestVersionRef.current) {
      return;
    }

    if (prakritiAbortRef.current === requestAbortController) {
      prakritiAbortRef.current = null;
    }

    setPrakritiLoading(false);

    if (result.error || !result.data) {
      setPrakritiError(result.error?.error?.message || "Prakriti estimation failed");
      return;
    }

    const data = result.data;
    patchForm((curr) => ({
      ...curr,
      prakriti: {
        vata: data.vata,
        pitta: data.pitta,
        kapha: data.kapha,
      },
      prakriti_confidence: data.confidence,
    }));
  }

  const errorTraceId = error?.trace_id;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xl font-semibold">Onboarding & Plan Builder</h3>
        <p className="mt-1 text-sm text-textSecondary">Complete the guided inputs below. We will map them safely to DecisionRequest_v1.</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="1. Profile" description="Basic personal details used for nutrition planning context." />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <FieldLabel label="name" />
            <input value={formState.profile.name} placeholder="Enter your full name" onChange={(e) => patchForm((curr) => ({ ...curr, profile: { ...curr.profile, name: e.target.value } }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <FieldLabel label="age" />
            <input type="number" min={0} step={1} placeholder="Age in years" value={numberToInputValue(formState.profile.age)} onChange={(e) => patchForm((curr) => ({ ...curr, profile: { ...curr.profile, age: parseNullableNumber(e.target.value) } }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <FieldLabel label="gender" />
            <select value={formState.profile.gender} onChange={(e) => patchForm((curr) => ({ ...curr, profile: { ...curr.profile, gender: e.target.value as PlanBuilderFormState["profile"]["gender"] } }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm">
              {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel label="height_cm" />
            <input type="number" min={0} step={0.1} placeholder="Height in centimeters" value={numberToInputValue(formState.profile.height_cm)} onChange={(e) => patchForm((curr) => ({ ...curr, profile: { ...curr.profile, height_cm: parseNullableNumber(e.target.value) } }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <FieldLabel label="weight_kg" />
            <input type="number" min={0} step={0.1} placeholder="Weight in kilograms" value={numberToInputValue(formState.profile.weight_kg)} onChange={(e) => patchForm((curr) => ({ ...curr, profile: { ...curr.profile, weight_kg: parseNullableNumber(e.target.value) } }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="2. Health" description="Select relevant health conditions and allergies." />
        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel label="conditions" />
            <HealthChecks selected={formState.risk_flags} onToggle={(value) => patchForm((curr) => ({ ...curr, risk_flags: toggleArrayValue(curr.risk_flags, value) }))} />
          </div>
          <div>
            <FieldLabel label="allergies" />
            <MultiSelectChecks options={ALLERGY_OPTIONS} selected={formState.allergies} onToggle={(value) => patchForm((curr) => ({ ...curr, allergies: toggleArrayValue(curr.allergies, value) }))} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="3. Symptoms" description="Enter symptoms as comma-separated values." />
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel label="symptoms input" />
            <textarea value={symptomInput} placeholder="Example: bloating, acidity, fatigue" onChange={(e) => { const next = e.target.value; setSymptomInput(next); patchForm((curr) => ({ ...curr, symptoms: parseTagInput(next) })); invalidatePrakritiState(); }} className="min-h-[84px] w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <FieldLabel label="derived symptom tags" />
            <div className="flex min-h-[42px] flex-wrap gap-2 rounded border border-border bg-surface px-3 py-2 text-xs">
              {symptomTags.length > 0 ? symptomTags.map((tag) => <span key={tag} className="rounded border border-border bg-card px-2 py-1">{tag}</span>) : <span className="text-textSecondary">Try entering symptoms like 'bloating', 'low energy'</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="4. Prakriti Assessment" description="Answer all questions, then calculate dosha from backend service." />
        <div className="mt-3 space-y-4">
          {PRAKRITI_QUESTIONS.map((question) => (
            <div key={question.id}>
              <p className="text-sm font-medium">{question.label}</p>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                {question.options.map((option) => (
                  <label key={`${question.id}-${option.value}`} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                    <input
                      type="radio"
                      name={question.id}
                      disabled={prakritiLoading}
                      checked={prakritiAnswers[question.id] === option.value}
                      onChange={() => {
                        setPrakritiError(null);
                        setPrakritiAnswers((curr) => ({ ...curr, [question.id]: option.value }));
                        invalidatePrakritiState();
                      }}
                      className="h-3.5 w-3.5"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-textSecondary">Completed: {assessmentAnsweredCount}/{PRAKRITI_QUESTIONS.length}</p>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!assessmentComplete || prakritiLoading} onClick={onCalculatePrakriti} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {prakritiLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              {prakritiLoading ? "Calculating..." : "Calculate Prakriti"}
            </button>
            <button type="button" onClick={() => { setPrakritiError(null); setPrakritiAnswers({}); invalidatePrakritiState(); }} className="rounded border border-border bg-surface px-3 py-2 text-sm">Reset Assessment</button>
          </div>

          {prakritiError ? <div className="rounded border border-error/50 bg-error/10 p-3 text-sm text-error">{prakritiError}</div> : null}

          <div className="rounded border border-border bg-surface p-3">
            {formState.prakriti ? (
              <div className="space-y-3">
                <DoshaBar label="Vata" value={formState.prakriti.vata} />
                <DoshaBar label="Pitta" value={formState.prakriti.pitta} />
                <DoshaBar label="Kapha" value={formState.prakriti.kapha} />
              </div>
            ) : (
              <p className="text-sm text-textSecondary">Prakriti not calculated yet. Please complete the assessment and click Calculate Prakriti.</p>
            )}
            <p className="mt-3 text-sm font-medium">Confidence: {formState.prakriti_confidence === null ? "--" : `${Math.round(formState.prakriti_confidence * 100)}%`}</p>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="5. Goals" description="Select one or more health goals for the planner." />
        <div className="mt-3">
          <MultiSelectChecks options={GOAL_OPTIONS} selected={formState.goals} onToggle={(value) => patchForm((curr) => ({ ...curr, goals: toggleArrayValue(curr.goals, value) }))} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <SectionIntro title="6. Constraints" description="Set practical limits for generated plans." />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <FieldLabel label="max_calories" />
            <input type="number" min={0} step={1} value={formState.max_calories} onChange={(e) => patchForm((curr) => ({ ...curr, max_calories: Number(e.target.value) }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <FieldLabel label="diet_type" />
            <select value={formState.diet_type} onChange={(e) => patchForm((curr) => ({ ...curr, diet_type: e.target.value as PlanBuilderFormState["diet_type"] }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm">
              <option value="vegetarian">vegetarian</option>
              <option value="vegan">vegan</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <details>
          <summary className="cursor-pointer text-lg font-semibold">7. Advanced</summary>
          <p className="mt-2 text-sm text-textSecondary">Optional system controls and request metadata.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <FieldLabel label="request_source" />
              <input value={formState.request_source} onChange={(e) => patchForm((curr) => ({ ...curr, request_source: e.target.value }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
            </div>
            <div>
              <FieldLabel label="cache_allowed" />
              <label className="flex h-[42px] items-center gap-2 rounded border border-border bg-surface px-3 text-sm">
                <input type="checkbox" checked={formState.cache_allowed} onChange={(e) => patchForm((curr) => ({ ...curr, cache_allowed: e.target.checked }))} />
                <span>{formState.cache_allowed ? "enabled" : "disabled"}</span>
              </label>
            </div>
            <div>
              <FieldLabel label="meal_type" />
              <select value={formState.meal_type} onChange={(e) => patchForm((curr) => ({ ...curr, meal_type: e.target.value as PlanBuilderFormState["meal_type"] }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm">
                <option value="breakfast">breakfast</option>
                <option value="lunch">lunch</option>
                <option value="dinner">dinner</option>
              </select>
            </div>
            <div>
              <FieldLabel label="season" />
              <select value={formState.season} onChange={(e) => patchForm((curr) => ({ ...curr, season: e.target.value as PlanBuilderFormState["season"] }))} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm">
                <option value="summer">summer</option>
                <option value="winter">winter</option>
                <option value="monsoon">monsoon</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <FieldLabel label="preferences" />
              <MultiSelectChecks options={PREFERENCE_OPTIONS} selected={formState.preferences} onToggle={(value) => patchForm((curr) => ({ ...curr, preferences: toggleArrayValue(curr.preferences, value) }))} />
            </div>
            <div className="lg:col-span-2">
              <FieldLabel label="debug toggles" />
              <label className="flex h-[42px] items-center gap-2 rounded border border-border bg-surface px-3 text-sm">
                <input type="checkbox" checked={showDebugView} onChange={(e) => setShowDebugView(e.target.checked)} />
                <span>{showDebugView ? "Debug / System View shown" : "Debug / System View hidden"}</span>
              </label>
            </div>
          </div>
        </details>
      </section>

      {showDebugView ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <details open>
            <summary className="cursor-pointer text-lg font-semibold">Debug / System View</summary>
            <p className="mt-2 text-sm text-textSecondary">Internal system data and derived flags. Read-only for diagnostics.</p>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="mb-1 font-medium">Derived flags</p>
                <pre className="overflow-auto rounded border border-border bg-surface p-3 font-mono">{JSON.stringify({ schemaValid, enumValid, boundsValid, profileBoundsValid, canSubmit }, null, 2)}</pre>
              </div>
              <div>
                <p className="mb-1 font-medium">user_state</p>
                <pre className="overflow-auto rounded border border-border bg-surface p-3 font-mono">{JSON.stringify(request.user_state, null, 2)}</pre>
              </div>
              <div>
                <p className="mb-1 font-medium">meta</p>
                <pre className="overflow-auto rounded border border-border bg-surface p-3 font-mono">{JSON.stringify(request.meta, null, 2)}</pre>
              </div>
            </div>
          </details>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">8. JSON Preview</h4>
          <button type="button" onClick={onCopyJson} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-textSecondary">
            <ClipboardCopy size={14} /> Copy
          </button>
        </div>
        {copyState !== "idle" ? <p className={`mt-2 text-xs ${copyState === "copied" ? "text-success" : "text-error"}`}>{copyState === "copied" ? "JSON copied" : "Failed to copy"}</p> : null}
        <pre className="mt-3 max-h-[360px] overflow-auto rounded border border-border bg-surface p-3 font-mono text-xs">{JSON.stringify(request, null, 2)}</pre>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">9. Validation Panel</h4>
        <p className="mt-1 text-sm text-textSecondary">A quick health check before submission.</p>
        <div className="mt-3 space-y-1 text-sm">
          <p className={schemaValid ? "text-success" : "text-error"}>{schemaValid ? "Looks good: request schema is valid." : "Please complete required fields"}</p>
          <p className={enumValid ? "text-success" : "text-error"}>{enumValid ? "Enums are valid." : "Please complete required fields"}</p>
          <p className={boundsValid ? "text-success" : "text-error"}>{boundsValid ? "Numeric bounds are valid." : "Please complete required fields"}</p>
          <p className={profileBoundsValid ? "text-success" : "text-error"}>{profileBoundsValid ? "Profile measurements look valid." : "Please complete required fields"}</p>
        </div>
        {issues.length > 0 ? <div className="mt-3 rounded border border-error/50 bg-error/10 p-3 text-xs text-error">{issues.map((issue, index) => <p key={`${issue}-${index}`}>{issue}</p>)}</div> : null}
      </section>

      {error ? (
        <section className="rounded-lg border border-error/50 bg-error/10 p-4 text-sm text-error">
          <p className="font-semibold">API Error</p>
          <p className="mt-1">{error.error.code}: {error.error.message}</p>
          {errorTraceId ? <p className="mt-1 font-mono text-xs">trace_id: {errorTraceId}</p> : null}
        </section>
      ) : null}

      <div>
        <button type="submit" disabled={!canSubmit} className="inline-flex items-center gap-2 rounded border border-accent bg-accent/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? "Submitting..." : "Submit DecisionRequest_v1"}
        </button>
      </div>
    </form>
  );
}









