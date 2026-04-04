import { useMemo, useState } from "react";
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

export function HealthStep({ showErrors = false }: HealthStepProps) {
  const health = useUserContextStore((s) => s.userContext.health);
  const setHealth = useUserContextStore((s) => s.setHealth);
  const [touched, setTouched] = useState(false);

  const markTouched = (_event: FocusEvent<HTMLInputElement>) => {
    setTouched(true);
  };

  const errors = useMemo(() => {
    if (!(showErrors || touched)) {
      return [] as string[];
    }

    return [] as string[];
  }, [showErrors, touched]);

  return (
    <section>
      <label>
        Conditions
        <input
          type="text"
          value={health.conditions.join(", ")}
          onBlur={markTouched}
          onChange={(event) => setHealth({ ...health, conditions: splitTags(event.target.value) })}
        />
      </label>

      <label>
        Allergies
        <input
          type="text"
          value={health.allergies.join(", ")}
          onBlur={markTouched}
          onChange={(event) => setHealth({ ...health, allergies: splitTags(event.target.value) })}
        />
      </label>

      <label>
        Dietary Restrictions
        <input
          type="text"
          value={health.dietary_restrictions.join(", ")}
          onBlur={markTouched}
          onChange={(event) => setHealth({ ...health, dietary_restrictions: splitTags(event.target.value) })}
        />
      </label>

      {errors.length > 0 && <p>{errors.join(" | ")}</p>}
    </section>
  );
}
