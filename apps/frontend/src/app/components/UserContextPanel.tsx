import { useNavigate } from "react-router-dom";
import { useUserContextStore } from "@/store/userContext.store";

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type UserContextPanelProps = {
  editPath?: string;
};

export function UserContextPanel({ editPath = "/app/onboarding" }: UserContextPanelProps) {
  const navigate = useNavigate();
  const userContext = useUserContextStore((s) => s.userContext);

  return (
    <aside className="h-fit rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm xl:sticky xl:top-5">
      <div className="border-b border-[#E6E1D8] pb-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">User Context</p>
        <h1 className="mt-2 text-lg font-semibold text-[#2F2F2F]">Profile Snapshot</h1>
      </div>

      <div className="mt-5 space-y-5 text-sm text-gray-600">
        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Identity</p>
          <ul className="mt-2 space-y-1.5">
            <li>Name: {userContext.profile.name || "-"}</li>
            <li>Age: {userContext.profile.age ?? "-"}</li>
            <li>Gender: {userContext.profile.gender ?? "-"}</li>
          </ul>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Goal</p>
          <p className="mt-2">{userContext.goals ?? "-"}</p>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Prakriti</p>
          <div className="mt-2 space-y-2.5">
            {(["vata", "pitta", "kapha"] as const).map((dosha) => {
              const value = userContext.prakriti ? userContext.prakriti[dosha] : 0;
              return (
                <div key={dosha}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wide text-gray-400">{dosha}</span>
                    <span className="font-medium text-[#2F2F2F]">{toPercent(value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E6E1D8]">
                    <div
                      className="h-full rounded-full bg-[#7A6F4B] transition-all duration-700 ease-out"
                      style={{ width: toPercent(value) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Conditions</p>
          <ul className="mt-2 space-y-1.5">
            {userContext.health.conditions.length > 0
              ? userContext.health.conditions.map((item) => <li key={item}>- {item}</li>)
              : <li>-</li>}
          </ul>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Constraints</p>
          <ul className="mt-2 space-y-1.5">
            <li>Diet type: {userContext.constraints.diet_type ?? "-"}</li>
            <li>Calorie limit: {userContext.constraints.calorie_limit ?? "-"}</li>
            {userContext.constraints.exclusions.length > 0
              ? userContext.constraints.exclusions.map((item) => <li key={item}>Exclusion: {item}</li>)
              : <li>Exclusion: -</li>}
          </ul>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400">Interpreted Profile</p>
          <ul className="mt-2 space-y-1.5">
            <li>Activity level: {userContext.profile.activity_level ?? "-"}</li>
            <li>Height: {userContext.profile.height || "-"}</li>
            <li>Weight: {userContext.profile.weight || "-"}</li>
          </ul>
        </section>
      </div>

      <div className="mt-6 border-t border-[#E6E1D8] pt-5">
        <p className="text-xs text-gray-400">Last updated: Current session</p>
        <button
          type="button"
          onClick={() => navigate(editPath)}
          className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700"
        >
          Edit Profile
        </button>
      </div>
    </aside>
  );
}
