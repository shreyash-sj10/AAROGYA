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
    if ((showErrors || touched) && !goals) {
      return ["Please select a goal"];
    }
    return [] as string[];
  }, [showErrors, touched, goals]);

  return (
    <section>
      <label>
        Goal
        <select
          value={goals ?? ""}
          onBlur={markTouched}
          onChange={(event) => setGoals(event.target.value || null)}
        >
          <option value="">Select goal</option>
          <option value="Weight Loss">Weight Loss</option>
          <option value="Muscle Gain">Muscle Gain</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Improve Digestion">Improve Digestion</option>
        </select>
      </label>

      {errors.length > 0 && <p>{errors.join(" | ")}</p>}
    </section>
  );
}
