import type { FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type SymptomsStepProps = {
  showErrors?: boolean;
};

export function validateSymptomsStep(context: UserContext): boolean {
  return context.symptoms.text.trim().length > 0;
}

function extractTags(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9_]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

export function SymptomsStep({ showErrors = false }: SymptomsStepProps) {
  const symptoms = useUserContextStore((s) => s.userContext.symptoms);
  const setSymptoms = useUserContextStore((s) => s.setSymptoms);

  const [touched, setTouched] = useState(false);
  const markTouched = (_event: FocusEvent<HTMLTextAreaElement>) => {
    setTouched(true);
  };

  const errors = useMemo(() => {
    if (!(showErrors || touched)) {
      return [] as string[];
    }
    if (symptoms.text.trim() === "") {
      return ["Please describe your symptoms"];
    }
    return [] as string[];
  }, [showErrors, touched, symptoms.text]);

  const inputClass =
    "mt-1 min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <section className="flex flex-col gap-2">
      <div>
        <label htmlFor="onboarding-symptoms" className="block text-sm font-medium text-slate-700">
          Symptoms
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Briefly describe what you are experiencing</p>
        <textarea
          id="onboarding-symptoms"
          className={`${inputClass} ${errors.length > 0 ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
          value={symptoms.text}
          onBlur={markTouched}
          onChange={(event) => {
            const text = event.target.value;
            setSymptoms({
              text,
              extracted_tags: extractTags(text),
            });
          }}
        />
        {errors.length > 0 && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
      </div>
    </section>
  );
}
