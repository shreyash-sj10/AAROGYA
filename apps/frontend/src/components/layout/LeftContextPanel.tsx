import { useNavigate } from "react-router-dom";
import { useUserContextStore } from "@/store/userContext.store";

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function LeftContextPanel() {
  const navigate = useNavigate();
  const userContext = useUserContextStore((s) => s.userContext);

  return (
    <aside className="sticky top-0 hidden h-full max-w-[248px] shrink-0 overflow-y-auto rounded-xl border border-[color:var(--plan-border-strong)] bg-[color:var(--plan-surface)] p-4 shadow-sm lg:block lg:w-[248px]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--plan-label)]">User context</p>
      <h2 className="mt-1 text-sm font-semibold text-[color:var(--plan-text)]">Profile snapshot</h2>

      <div className="mt-4 space-y-4 text-xs text-[color:var(--plan-muted)]">
        <section>
          <p className="font-semibold uppercase tracking-wide text-slate-400">Identity</p>
          <ul className="mt-1.5 space-y-1">
            <li>{userContext.profile.name || "—"}</li>
            <li>
              {userContext.profile.age ?? "—"} · {userContext.profile.gender ?? "—"}
            </li>
          </ul>
        </section>

        <section>
          <p className="font-semibold uppercase tracking-wide text-slate-400">Goal</p>
          <p className="mt-1">{userContext.goals ?? "—"}</p>
        </section>

        <section>
          <p className="font-semibold uppercase tracking-wide text-slate-400">Dosha</p>
          <div className="mt-2 space-y-2">
            {(["vata", "pitta", "kapha"] as const).map((dosha) => {
              const value = userContext.prakriti ? userContext.prakriti[dosha] : 0;
              return (
                <div key={dosha}>
                  <div className="mb-0.5 flex justify-between text-[10px] uppercase text-slate-500">
                    <span>{dosha}</span>
                    <span className="font-mono text-slate-800">{toPercent(value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[color:var(--plan-accent)]/80" style={{ width: toPercent(value) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button type="button" onClick={() => navigate("/app/onboarding")} className="plan-btn-secondary w-full !text-xs">
          Edit profile
        </button>
      </div>
    </aside>
  );
}
