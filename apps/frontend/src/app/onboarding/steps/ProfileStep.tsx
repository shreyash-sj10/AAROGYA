import type { ChangeEvent, FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type ProfileStepProps = {
  showErrors?: boolean;
};

export function validateProfileStep(context: UserContext): boolean {
  return context.profile.name.trim().length > 0
    && context.profile.age !== null
    && context.profile.age > 0
    && context.profile.gender !== null;
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProfileStep({ showErrors = false }: ProfileStepProps) {
  const profile = useUserContextStore((s) => s.userContext.profile);
  const setProfile = useUserContextStore((s) => s.setProfile);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => (_event: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const errors = useMemo(() => {
    const messages: string[] = [];
    const showNameError = showErrors || touched.name;
    const showAgeError = showErrors || touched.age;
    const showGenderError = showErrors || touched.gender;

    if (showNameError && profile.name.trim() === "") {
      messages.push("Please enter your full name");
    }

    if (showAgeError && (profile.age === null || profile.age <= 0)) {
      messages.push("Please enter your age");
    }

    if (showGenderError && !profile.gender) {
      messages.push("Please select gender");
    }

    if (showAgeError && profile.age !== null && profile.age <= 0) {
      messages.push("Please enter a valid number");
    }

    return [...new Set(messages)];
  }, [profile, showErrors, touched]);

  const onNumberChange = (field: "age") => (event: ChangeEvent<HTMLInputElement>) => {
    setProfile({
      ...profile,
      [field]: toNumberOrNull(event.target.value),
    });
  };

  return (
    <section>
      <label>
        Full Name
        <input
          type="text"
          value={profile.name}
          onBlur={markTouched("name")}
          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
        />
      </label>

      <label>
        Age
        <input
          type="number"
          value={profile.age ?? ""}
          onBlur={markTouched("age")}
          onChange={onNumberChange("age")}
        />
      </label>

      <label>
        Gender
        <select
          value={profile.gender ?? ""}
          onBlur={markTouched("gender")}
          onChange={(event) => setProfile({
            ...profile,
            gender: event.target.value === "" ? null : (event.target.value as "male" | "female" | "other"),
          })}
        >
          <option value="">Select gender</option>
          <option value="male">male</option>
          <option value="female">female</option>
          <option value="other">other</option>
        </select>
      </label>

      <label>
        Activity Level (optional)
        <input
          type="text"
          value={profile.activity_level ?? ""}
          onBlur={markTouched("activity_level")}
          onChange={(event) => setProfile({
            ...profile,
            activity_level: event.target.value.trim() === "" ? null : event.target.value,
          })}
        />
      </label>

      {errors.length > 0 && <p>{errors.join(" | ")}</p>}
    </section>
  );
}
