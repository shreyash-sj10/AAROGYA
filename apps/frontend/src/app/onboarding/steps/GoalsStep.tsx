import type { FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type GoalsStepProps = {
  showErrors?: boolean;
};

export function validateGoalsStep(context: UserContext): boolean {
  return context.goals !== null && context.goals.trim().length > 0;
}

export function GoalsStep({ showErrors = false }: GoalsStepProps) {
  const goals = useUserContextStore((s) => s.userContext.goals);
  const setGoals = useUserContextStore((s) => s.setGoals);

  const [touched, setTouched] = useState(false);
  const markTouched = (_event: FocusEvent<HTMLSelectElement>) => {
    setTouched(true);
  };

  const errors = useMemo(() => {
    if (!(showErrors || touched)) {
      return [] as string[];
    }
    if (!goals || !goals.trim()) {
      return ["Please select a goal"];
    }
    return [] as string[];
  }, [showErrors, touched, goals]);

  const inputClass =
    "mt-1 w-full rounded-xl border border-[#E6E1D8] bg-white px-3 py-2 text-sm text-[#2F2F2F] focus:border-[#7A6F4B] focus:outline-none focus:ring-1 focus:ring-[#7A6F4B]";

  return (
    <section className="flex flex-col gap-2">
      <div>
        <label htmlFor="onboarding-goals" className="block text-sm font-medium text-[#2F2F2F]">
          Primary goal
        </label>
        <select
          id="onboarding-goals"
          className={`${inputClass} ${errors.length > 0 ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
          value={goals ?? ""}
          onBlur={markTouched}
          onChange={(event) => {
            setTouched(true);
            setGoals(event.target.value || null);
          }}
        >
          <option value="">Select a goal</option>
          <option value="Weight Loss">Weight loss</option>
          <option value="Muscle Gain">Muscle gain</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Improve Digestion">Improve digestion</option>
        </select>
        {errors.length > 0 && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
      </div>
    </section>
  );
}

