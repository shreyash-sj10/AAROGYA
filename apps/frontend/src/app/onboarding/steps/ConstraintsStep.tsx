import type { ChangeEvent, FocusEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type ConstraintsStepProps = {
  showErrors?: boolean;
};

export function validateConstraintsStep(context: UserContext): boolean {
  return (
    (context.constraints.diet_type ?? "").trim().length > 0
    && context.constraints.calorie_limit !== null
    && context.constraints.calorie_limit > 0
  );
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function joinTags(tags: string[]): string {
  return tags.join(", ");
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ConstraintsStep({ showErrors = false }: ConstraintsStepProps) {
  const constraints = useUserContextStore((s) => s.userContext.constraints);
  const setConstraints = useUserContextStore((s) => s.setConstraints);

  const [exclusionsDraft, setExclusionsDraft] = useState(() => joinTags(constraints.exclusions));
  const exclusionsRef = useRef(exclusionsDraft);
  exclusionsRef.current = exclusionsDraft;

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => (_event: FocusEvent<HTMLInputElement>) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const commitExclusions = () => {
    const latest = useUserContextStore.getState().userContext.constraints;
    setConstraints({
      ...latest,
      exclusions: splitTags(exclusionsRef.current),
    });
  };

  useEffect(() => {
    return () => {
      const latest = useUserContextStore.getState().userContext.constraints;
      useUserContextStore.getState().setConstraints({
        ...latest,
        exclusions: splitTags(exclusionsRef.current),
      });
    };
  }, []);

  const fieldErrors = useMemo(() => {
    const showDiet = showErrors || touched.diet_type;
    const showCal = showErrors || touched.calorie_limit;

    return {
      diet_type:
        showDiet && (!constraints.diet_type || constraints.diet_type.trim() === "")
          ? "Please enter a diet type"
          : null,
      calorie_limit:
        showCal && (constraints.calorie_limit === null || constraints.calorie_limit <= 0)
          ? "Please enter a daily calorie limit"
          : null,
    };
  }, [constraints, showErrors, touched]);

  const onNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConstraints({
      ...constraints,
      calorie_limit: toNumberOrNull(event.target.value),
    });
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
  const errorRing = "border-red-400 focus:border-red-500 focus:ring-red-500";

  return (
    <section className="flex flex-col gap-5">
      <div>
        <label htmlFor="onboarding-constraints-diet" className="block text-sm font-medium text-slate-700">
          Diet type
        </label>
        <input
          id="onboarding-constraints-diet"
          className={`${inputClass} ${fieldErrors.diet_type ? errorRing : ""}`}
          type="text"
          value={constraints.diet_type ?? ""}
          onBlur={markTouched("diet_type")}
          onChange={(event) =>
            setConstraints({
              ...constraints,
              diet_type: event.target.value.trim() === "" ? null : event.target.value,
            })
          }
        />
        {fieldErrors.diet_type && <p className="mt-1 text-sm text-red-600">{fieldErrors.diet_type}</p>}
      </div>

      <div>
        <label htmlFor="onboarding-constraints-calories" className="block text-sm font-medium text-slate-700">
          Daily calorie limit
        </label>
        <input
          id="onboarding-constraints-calories"
          className={`${inputClass} ${fieldErrors.calorie_limit ? errorRing : ""}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={constraints.calorie_limit ?? ""}
          onBlur={markTouched("calorie_limit")}
          onChange={onNumberChange}
        />
        {fieldErrors.calorie_limit && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.calorie_limit}</p>
        )}
      </div>

      <div>
        <label htmlFor="onboarding-constraints-exclusions" className="block text-sm font-medium text-slate-700">
          Food exclusions <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Separate items with commas</p>
        <input
          id="onboarding-constraints-exclusions"
          className={inputClass}
          type="text"
          value={exclusionsDraft}
          onBlur={() => {
            commitExclusions();
          }}
          onChange={(event) => setExclusionsDraft(event.target.value)}
        />
      </div>
    </section>
  );
}
