import { useState } from "react";
import type { PrakritiEstimateRequest } from "@/services/api/prakriti.api";
import { usePrakritiFlowHandler } from "@/services/prakriti/usePrakritiFlowHandler";
import type { UserContext } from "@/store/userContext.store";

type PrakritiQuestionnaireStepProps = {
  showErrors?: boolean;
  onCompleted?: () => void;
  onCancel?: () => void;
};

type AnswerKey = keyof PrakritiEstimateRequest["answers"];

type QuestionDef = {
  id: AnswerKey;
  title: string;
  helper?: string;
  options: Array<{
    value: PrakritiEstimateRequest["answers"][AnswerKey];
    label: string;
  }>;
};

const QUESTIONS: QuestionDef[] = [
  {
    id: "body_build",
    title: "How would you describe your natural body build?",
    helper: "Think of your tendency, not short-term weight change.",
    options: [
      { value: "thin", label: "Thin or lean frame" },
      { value: "medium", label: "Medium, balanced build" },
      { value: "heavy", label: "Broader or solid build" },
    ],
  },
  {
    id: "skin",
    title: "How would you describe your skin in general?",
    options: [
      { value: "dry", label: "Often dry or rough" },
      { value: "warm_oily", label: "Warm, sensitive, or oily" },
      { value: "thick_cool", label: "Thick, cool, or smooth" },
    ],
  },
  {
    id: "appetite",
    title: "How is your digestion and appetite?",
    options: [
      { value: "irregular", label: "Irregular or variable" },
      { value: "strong", label: "Strong or sharp" },
      { value: "slow", label: "Slow or steady" },
    ],
  },
  {
    id: "energy",
    title: "How is your energy through the day?",
    options: [
      { value: "variable", label: "Comes and goes" },
      { value: "intense", label: "Intense bursts" },
      { value: "stable", label: "Steady and even" },
    ],
  },
  {
    id: "nature",
    title: "How would close friends describe your temperament?",
    options: [
      { value: "anxious", label: "Quick, worried, or restless" },
      { value: "irritable", label: "Sharp, driven, or intense" },
      { value: "calm", label: "Calm, easy-going, or slow to ruffle" },
    ],
  },
  {
    id: "sleep",
    title: "How is your sleep pattern?",
    options: [
      { value: "light", label: "Light, interrupted, or little" },
      { value: "moderate", label: "Moderate, fairly regular" },
      { value: "deep", label: "Deep, long, or hard to wake" },
    ],
  },
  {
    id: "climate",
    title: "Which climate do you tolerate best?",
    options: [
      { value: "warm", label: "Warm weather" },
      { value: "cool", label: "Cool weather" },
      { value: "dry", label: "Dry air" },
    ],
  },
  {
    id: "food_response",
    title: "After meals, what do you notice most often?",
    options: [
      { value: "bloated", label: "Bloating or gas" },
      { value: "acidic", label: "Heat, acidity, or burning" },
      { value: "sluggish", label: "Heaviness or sluggishness" },
    ],
  },
  {
    id: "work_style",
    title: "How do you tend to work or focus?",
    options: [
      { value: "inconsistent", label: "Many starts, variable rhythm" },
      { value: "intense", label: "Short, intense pushes" },
      { value: "steady", label: "Slow, steady, consistent" },
    ],
  },
  {
    id: "weight",
    title: "How has your weight tended to behave over time?",
    helper: "Long-term tendency, not a diet phase.",
    options: [
      { value: "lose", label: "Hard to gain; easy to lose" },
      { value: "stable", label: "Fairly stable" },
      { value: "gain", label: "Easy to gain" },
    ],
  },
];

export function validatePrakritiStep(context: UserContext): boolean {
  return context.prakriti !== null;
}

export function PrakritiQuestionnaireStep({ showErrors: _showErrors = false, onCompleted, onCancel }: PrakritiQuestionnaireStepProps) {
  const { answers, setAnswer, estimateAndStore, loading, error } = usePrakritiFlowHandler();
  const [index, setIndex] = useState(0);

  const total = QUESTIONS.length;
  const current = QUESTIONS[index];
  const selected = current ? answers[current.id] : undefined;
  const progress = Math.round(((index + 1) / total) * 100);

  const goBack = () => {
    setIndex((i) => Math.max(0, i - 1));
  };

  const goNext = async () => {
    if (!current || selected === undefined) {
      return;
    }

    if (index < total - 1) {
      setIndex((i) => i + 1);
      return;
    }

    const result = await estimateAndStore();
    if (result.ok) {
      onCompleted?.();
    }
  };

  if (!current) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
          <span>
            Question {index + 1} of {total}
          </span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200/80">
          <div
            className="h-full rounded-full bg-emerald-600/90 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div key={current.id} className="rounded-xl border border-stone-200/90 bg-white/90 p-5 shadow-sm ring-1 ring-stone-100 transition-all duration-200">
        <h2 className="text-base font-semibold leading-snug text-stone-900">{current.title}</h2>
        {current.helper && (
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{current.helper}</p>
        )}

        <div className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-labelledby={`pq-${current.id}`}>
          <span id={`pq-${current.id}`} className="sr-only">
            {current.title}
          </span>
          {current.options.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setAnswer(current.id, opt.value)}
                className={[
                  "w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-200",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600/50",
                  isSelected
                    ? "border-emerald-500/80 bg-emerald-50/90 text-emerald-950 shadow-sm ring-1 ring-emerald-500/25"
                    : "border-stone-200/90 bg-stone-50/50 text-stone-800 hover:border-emerald-300/60 hover:bg-white",
                ].join(" ")}
              >
                <span className="font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={goBack}
            disabled={index === 0 || loading}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={selected === undefined || loading}
          className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Saving..." : index === total - 1 ? "Complete Assessment" : "Next"}
        </button>
      </div>
    </section>
  );
}
