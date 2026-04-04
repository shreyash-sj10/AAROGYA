import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type HealthStepProps = {
  showErrors?: boolean;
};

export function validateHealthStep(_context: UserContext): boolean {
  return true;
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

export function HealthStep({ showErrors = false }: HealthStepProps) {
  const health = useUserContextStore((s) => s.userContext.health);
  const setHealth = useUserContextStore((s) => s.setHealth);

  const [conditionsDraft, setConditionsDraft] = useState(() => joinTags(health.conditions));
  const [allergiesDraft, setAllergiesDraft] = useState(() => joinTags(health.allergies));
  const [restrictionsDraft, setRestrictionsDraft] = useState(() => joinTags(health.dietary_restrictions));

  const conditionsRef = useRef(conditionsDraft);
  const allergiesRef = useRef(allergiesDraft);
  const restrictionsRef = useRef(restrictionsDraft);
  conditionsRef.current = conditionsDraft;
  allergiesRef.current = allergiesDraft;
  restrictionsRef.current = restrictionsDraft;

  const [touched, setTouched] = useState(false);
  const markTouched = (_event: FocusEvent<HTMLInputElement>) => {
    setTouched(true);
  };

  const commitDrafts = () => {
    const latest = useUserContextStore.getState().userContext.health;
    setHealth({
      ...latest,
      conditions: splitTags(conditionsRef.current),
      allergies: splitTags(allergiesRef.current),
      dietary_restrictions: splitTags(restrictionsRef.current),
    });
  };

  useEffect(() => {
    return () => {
      const latest = useUserContextStore.getState().userContext.health;
      useUserContextStore.getState().setHealth({
        ...latest,
        conditions: splitTags(conditionsRef.current),
        allergies: splitTags(allergiesRef.current),
        dietary_restrictions: splitTags(restrictionsRef.current),
      });
    };
  }, []);

  const errors = useMemo(() => {
    if (!(showErrors || touched)) {
      return [] as string[];
    }
    return [] as string[];
  }, [showErrors, touched]);

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <section className="flex flex-col gap-5">
      <div>
        <label htmlFor="onboarding-health-conditions" className="block text-sm font-medium text-slate-700">
          Conditions
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Separate items with commas (e.g. diabetes, hypertension)</p>
        <input
          id="onboarding-health-conditions"
          className={inputClass}
          type="text"
          value={conditionsDraft}
          onBlur={(e) => {
            markTouched(e);
            commitDrafts();
          }}
          onChange={(event) => setConditionsDraft(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="onboarding-health-allergies" className="block text-sm font-medium text-slate-700">
          Allergies
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Separate items with commas</p>
        <input
          id="onboarding-health-allergies"
          className={inputClass}
          type="text"
          value={allergiesDraft}
          onBlur={(e) => {
            markTouched(e);
            commitDrafts();
          }}
          onChange={(event) => setAllergiesDraft(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="onboarding-health-restrictions" className="block text-sm font-medium text-slate-700">
          Dietary restrictions
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Separate items with commas</p>
        <input
          id="onboarding-health-restrictions"
          className={inputClass}
          type="text"
          value={restrictionsDraft}
          onBlur={(e) => {
            markTouched(e);
            commitDrafts();
          }}
          onChange={(event) => setRestrictionsDraft(event.target.value)}
        />
      </div>

      {errors.length > 0 && <p className="text-sm text-red-600">{errors.join(" ")}</p>}
    </section>
  );
}
