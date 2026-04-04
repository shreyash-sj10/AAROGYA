import type { ChangeEvent, FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type ConstraintsStepProps = {
  showErrors?: boolean;
};

export function validateConstraintsStep(context: UserContext): boolean {
  return (context.constraints.diet_type ?? "").trim().length > 0
    && context.constraints.calorie_limit !== null
    && context.constraints.calorie_limit > 0;
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => (_event: FocusEvent<HTMLInputElement>) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const errors = useMemo(() => {
    const messages: string[] = [];

    if ((showErrors || touched.diet_type) && (!constraints.diet_type || constraints.diet_type.trim() === "")) {
      messages.push("Please enter diet type");
    }

    if ((showErrors || touched.calorie_limit) && (constraints.calorie_limit === null || constraints.calorie_limit <= 0)) {
      messages.push("Please enter a valid number");
    }

    return messages;
  }, [constraints, showErrors, touched]);

  const onNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConstraints({
      ...constraints,
      calorie_limit: toNumberOrNull(event.target.value),
    });
  };

  return (
    <section>
      <label>
        Diet Type
        <input
          type="text"
          value={constraints.diet_type ?? ""}
          onBlur={markTouched("diet_type")}
          onChange={(event) => setConstraints({
            ...constraints,
            diet_type: event.target.value.trim() === "" ? null : event.target.value,
          })}
        />
      </label>

      <label>
        Calorie Limit
        <input
          type="number"
          value={constraints.calorie_limit ?? ""}
          onBlur={markTouched("calorie_limit")}
          onChange={onNumberChange}
        />
      </label>

      <label>
        Food Exclusions
        <input
          type="text"
          value={constraints.exclusions.join(", ")}
          onBlur={markTouched("exclusions")}
          onChange={(event) => setConstraints({
            ...constraints,
            exclusions: splitTags(event.target.value),
          })}
        />
      </label>

      {errors.length > 0 && <p>{errors.join(" | ")}</p>}
    </section>
  );
}
