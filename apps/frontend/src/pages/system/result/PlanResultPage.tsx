import { Loader2, RefreshCw } from "lucide-react";
import { usePlanStore } from "@/state/plan.store";

function StatusBadge({ status }: { status: "idle" | "loading" | "success" | "error" }) {
  const color = status === "success"
    ? "text-success"
    : status === "error"
      ? "text-error"
      : status === "loading"
        ? "text-warning"
        : "text-textSecondary";

  return <span className={`rounded border border-border px-2 py-1 text-xs ${color}`}>{status}</span>;
}

export function PlanResultPage() {
  const { data, loading, error, runPlan, requestDraft } = usePlanStore();

  const status: "idle" | "loading" | "success" | "error" = loading
    ? "loading"
    : error
      ? "error"
      : data
        ? "success"
        : "idle";

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-textSecondary">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading plan response...</span>
        </div>
      </section>
    );
  }

  if (error) {
    const traceId = typeof error.error.details?.trace_id === "string"
      ? error.error.details.trace_id
      : requestDraft.trace_id;

    return (
      <section className="space-y-3 rounded-lg border border-error/50 bg-error/10 p-4">
        <h3 className="text-xl font-semibold text-error">Plan Result Error</h3>
        <p className="text-sm text-error">code: {error.error.code}</p>
        <p className="text-sm text-error">message: {error.error.message}</p>
        <p className="font-mono text-xs text-error">trace_id: {traceId}</p>
        <button
          type="button"
          onClick={() => void runPlan()}
          className="inline-flex items-center gap-2 rounded border border-error/70 px-3 py-2 text-sm text-error"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xl font-semibold">Plan Result</h3>
        <p className="mt-2 text-sm text-textSecondary">No response available yet. Submit from Plan Builder first.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-semibold">Plan Result</h3>
          <StatusBadge status={status} />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-textSecondary lg:grid-cols-2">
          <p className="font-mono">request_id: {data.request_id}</p>
          <p className="font-mono">trace_id: {data.trace_id}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Meal Plan</h4>
        <div className="mt-3 space-y-2">
          {data.meal_plan.map((item) => (
            <article key={item.recipe_id} className="rounded border border-border bg-surface p-3">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-textSecondary">recipe_id: {item.recipe_id}</p>
              <p className="mt-1 text-xs text-textSecondary">
                quantity: {item.quantity.value} {item.quantity.unit}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">System Metrics</h4>
        <div className="mt-3 grid gap-2 text-sm lg:grid-cols-2">
          <p>score: {data.score.toFixed(3)}</p>
          <p>
            confidence: {data.confidence.value.toFixed(3)} ({data.confidence.level})
          </p>
          <p>latency_ms: {data.meta.latency_ms}</p>
          <p>cache_hit: {data.meta.cache_hit ? "true" : "false"}</p>
          <p>served_latency_ms: {typeof data.meta.served_latency_ms === "number" ? data.meta.served_latency_ms : "n/a"}</p>
          <p>model_version: {data.meta.model_version}</p>
          <p>prompt_version: {data.meta.prompt_version}</p>
          <p>rules_version: {data.meta.rules_version}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Confidence Components</h4>
        <div className="mt-3 grid gap-2 text-sm lg:grid-cols-3">
          <p>penalty_impact: {data.confidence.components.penalty_impact.toFixed(3)}</p>
          <p>diversity_impact: {data.confidence.components.diversity_impact.toFixed(3)}</p>
          <p>relaxation_impact: {data.confidence.components.relaxation_impact.toFixed(3)}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Nutrition Summary</h4>
        <div className="mt-3 grid gap-2 text-sm lg:grid-cols-2">
          <p>calories: {data.nutrition_summary.calories}</p>
          <p>protein: {data.nutrition_summary.protein}</p>
          <p>carbs: {data.nutrition_summary.carbs}</p>
          <p>fat: {data.nutrition_summary.fat}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-lg font-semibold">Explanation</h4>
        <div className="mt-3 space-y-2 text-sm">
          <p>{data.explanation.deterministic}</p>
          {data.explanation.ai_explanation ? (
            <p className="text-textSecondary">{data.explanation.ai_explanation}</p>
          ) : null}
        </div>

        <div className="mt-4">
          <h5 className="text-sm font-medium">Citations</h5>
          {data.explanation.citations.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-textSecondary">
              {data.explanation.citations.map((citation) => (
                <li key={`${citation.text_id}:${citation.chapter}`}>
                  {citation.text_id} | {citation.source} | {citation.chapter}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-textSecondary">No citations provided.</p>
          )}
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={() => void runPlan()}
          className="inline-flex items-center gap-2 rounded border border-accent bg-accent/20 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );
}
