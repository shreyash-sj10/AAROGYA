import type { ChangeEvent, FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type ProfileStepProps = {
  showErrors?: boolean;
};

export function validateProfileStep(context: UserContext): boolean {
  return (
    context.profile.name.trim().length > 0
    && context.profile.age !== null
    && context.profile.age > 0
    && context.profile.gender !== null
  );
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

  const fieldErrors = useMemo(() => {
    const showName = showErrors || touched.name;
    const showAge = showErrors || touched.age;
    const showGender = showErrors || touched.gender;

    return {
      name: showName && profile.name.trim() === "" ? "Please enter your full name" : null,
      age: showAge && (profile.age === null || profile.age <= 0) ? "Please enter your age" : null,
      gender: showGender && !profile.gender ? "Please select gender" : null,
    };
  }, [profile, showErrors, touched]);

  const onNumberChange = (field: "age") => (event: ChangeEvent<HTMLInputElement>) => {
    setProfile({
      ...profile,
      [field]: toNumberOrNull(event.target.value),
    });
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
  const errorRing = "border-red-400 focus:border-red-500 focus:ring-red-500";

  return (
    <section className="flex flex-col gap-5">
      <div>
        <label htmlFor="onboarding-profile-name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <input
          id="onboarding-profile-name"
          className={`${inputClass} ${fieldErrors.name ? errorRing : ""}`}
          type="text"
          autoComplete="name"
          value={profile.name}
          onBlur={markTouched("name")}
          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
        />
        {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
      </div>

      <div>
        <label htmlFor="onboarding-profile-age" className="block text-sm font-medium text-slate-700">
          Age
        </label>
        <input
          id="onboarding-profile-age"
          className={`${inputClass} ${fieldErrors.age ? errorRing : ""}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={profile.age ?? ""}
          onBlur={markTouched("age")}
          onChange={onNumberChange("age")}
        />
        {fieldErrors.age && <p className="mt-1 text-sm text-red-600">{fieldErrors.age}</p>}
      </div>

      <div>
        <label htmlFor="onboarding-profile-gender" className="block text-sm font-medium text-slate-700">
          Gender
        </label>
        <select
          id="onboarding-profile-gender"
          className={`${inputClass} ${fieldErrors.gender ? errorRing : ""}`}
          value={profile.gender ?? ""}
          onBlur={markTouched("gender")}
          onChange={(event) =>
            setProfile({
              ...profile,
              gender: event.target.value === "" ? null : (event.target.value as "male" | "female" | "other"),
            })
          }
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {fieldErrors.gender && <p className="mt-1 text-sm text-red-600">{fieldErrors.gender}</p>}
      </div>

      <div>
        <label htmlFor="onboarding-profile-activity" className="block text-sm font-medium text-slate-700">
          Activity level <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="onboarding-profile-activity"
          className={inputClass}
          type="text"
          value={profile.activity_level ?? ""}
          onBlur={markTouched("activity_level")}
          onChange={(event) =>
            setProfile({
              ...profile,
              activity_level: event.target.value.trim() === "" ? null : event.target.value,
            })
          }
        />
      </div>
    </section>
  );
}
