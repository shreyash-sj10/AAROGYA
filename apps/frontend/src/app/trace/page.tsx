"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { usePlanStore } from "@/store/plan.store";
import { apiClient } from "@/services/api/apiClient";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import { TracePipelineStrip } from "@/components/trace/TracePipelineStrip";
import { EngineeringPageHeader } from "@/components/ui/EngineeringPageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

type TraceStage = {
  input_count: number;
  output_count: number;
  rejected?: number;
  rules?: Array<{ rule_id: string; action: string; reason: string }>;
  [key: string]: unknown;
};

type TraceV1 = {
  version: string;
  trace_id: string;
  timestamp: number;
  stages: {
    interpretation_layer: Record<string, unknown>;
    candidate_generator: TraceStage;
    constraint_engine: TraceStage & {
      p0_rules_checked?: number;
      p0_violations?: number;
      p0_violated_rule_ids?: string[];
    };
    scoring_engine: TraceStage;
    diversity_engine: TraceStage;
    optimizer: TraceStage & { combinations_evaluated?: number; selected_score?: number };
    reliability_engine: TraceStage & {
      relaxation_level?: number;
      relaxed_priorities?: string[];
      confidence_eval?: Record<string, number>;
    };
  };
  execution?: { stages: Record<string, Record<string, unknown>> };
  safe?: { stages: Record<string, Record<string, unknown>> };
};

const unknownSchema = z.unknown();

function Section({
  title,
  children,
  isHealed,
  isSafetyCore,
}: {
  title: string;
  children: ReactNode;
  isHealed?: boolean;
  isSafetyCore?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm transition-colors ${
        isSafetyCore
          ? "border-emerald-200 bg-emerald-50/20"
          : isHealed
            ? "border-amber-200 bg-amber-50/30"
            : "border-[#E6E1D8] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        {isSafetyCore ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">Safety Core</span>
        ) : isHealed ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">Healed</span>
        ) : null}
      </div>
      <div className="mt-3 text-sm text-[#2F2F2F]">{children}</div>
    </section>
  );
}

function StatItem({ label, value, isChanged }: { label: string; value: string | number; isChanged?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${isChanged ? "bg-amber-100/50 font-medium" : ""}`}>
      <span className="text-gray-500">{label}</span>
      <span className={isChanged ? "text-amber-700" : "text-gray-900"}>{value}</span>
    </div>
  );
}

function formatTraceTime(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function TracePage() {
  const plan = usePlanStore((s) => s.plan) as DecisionResponseV1 | null;
  const lastRequest = usePlanStore((s) => s.lastDecisionRequest);
  const [view, setView] = useState<"safe" | "execution">("execution");
  const [auditStatus, setAuditStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!plan || !plan.trace) {
    return (
      <section className="rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[#2F2F2F]">Decision Trace</h1>
        <p className="mt-3 text-sm text-gray-600">No detailed trace in session. Generate a plan from the Planner, then return here.</p>
        <Link
          to="/app/planner"
          className="mt-4 inline-block rounded-lg bg-[#7A6F4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6b6146]"
        >
          Go to Planner
        </Link>
      </section>
    );
  }

  const trace = plan.trace as unknown as TraceV1;
  const executionTrace = trace.execution || trace;
  const safeTrace = trace.safe || trace;
  const currentTrace = view === "safe" ? safeTrace : executionTrace;
  const stages = currentTrace.stages as TraceV1["stages"];

  const diversity = stages.diversity_engine as TraceStage & {
    historical_matches_count?: number;
    diversity_penalty_applied?: number;
  };
  const reliability = stages.reliability_engine;

  const handleReplay = async () => {
    setLoading(true);
    setAuditStatus("Replaying decision...");
    try {
      const result = await apiClient<unknown>({
        method: "POST",
        path: "/plan/replay",
        body: { request_id: plan.request_id },
        requestSchema: z.object({ request_id: z.string().min(1) }).strict(),
        responseSchema: unknownSchema,
      });

      const payload = result.data as { is_identical?: boolean } | null;
      if (!result.error && payload?.is_identical === true) {
        setAuditStatus("PASS: Determinism verified. Output is identical.");
      } else if (!result.error && payload?.is_identical === false) {
        setAuditStatus("WARN: Divergence detected. Output differs from original.");
      } else {
        setAuditStatus("FAIL: Replay endpoint unavailable.");
      }
    } catch {
      setAuditStatus("FAIL: Replay request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestDeterminism = async () => {
    setLoading(true);
    setAuditStatus("Testing determinism over repeated runs...");
    try {
      const decisionContext = (plan as unknown as { decision_context?: Record<string, unknown> }).decision_context ?? {};
      const result = await apiClient<unknown>({
        method: "POST",
        path: "/plan/test-determinism",
        body: decisionContext,
        requestSchema: z.record(z.unknown()),
        responseSchema: unknownSchema,
      });

      const payload = result.data as { identical_outputs?: boolean; identical_traces?: boolean; iterations?: number } | null;
      const iterations = typeof payload?.iterations === "number" ? payload.iterations : 0;

      if (!result.error && payload?.identical_outputs === true && payload?.identical_traces === true) {
        setAuditStatus(`PASS: Output and trace are identical across ${iterations || "multiple"} runs.`);
      } else if (!result.error && (payload?.identical_outputs === false || payload?.identical_traces === false)) {
        setAuditStatus("WARN: Determinism mismatch detected in output or trace.");
      } else {
        setAuditStatus("FAIL: Determinism test endpoint unavailable.");
      }
    } catch {
      setAuditStatus("FAIL: Determinism test request failed.");
    } finally {
      setLoading(false);
    }
  };

  const checkHealed = (stageName: string) => {
    if (!trace.execution || !trace.safe) return false;
    const raw = JSON.stringify(trace.execution.stages[stageName]);
    const safe = JSON.stringify(trace.safe.stages[stageName]);
    return raw !== safe;
  };

  const checkStatHealed = (stageName: string, statKey: string) => {
    if (!trace.execution || !trace.safe) return false;
    const rawVal = trace.execution.stages[stageName]?.[statKey];
    const safeVal = trace.safe.stages[stageName]?.[statKey];
    return rawVal !== safeVal;
  };

  const hasSafetyViolations = (stages.constraint_engine.p0_violations ?? 0) > 0;

  const pipelineStages = useMemo(() => {
    const s = stages;
    return [
      { key: "interp", label: "Interpret", input: 1, output: 1 },
      { key: "cand", label: "Candidates", input: s.candidate_generator.input_count, output: s.candidate_generator.output_count },
      {
        key: "p0",
        label: "P0 / rules",
        input: s.constraint_engine.input_count,
        output: s.constraint_engine.output_count,
        highlight: "p0" as const,
      },
      { key: "score", label: "Scoring", input: s.scoring_engine.input_count, output: s.scoring_engine.output_count },
      { key: "div", label: "Diversity", input: s.diversity_engine.input_count, output: s.diversity_engine.output_count },
      {
        key: "opt",
        label: "Optimizer",
        input: s.optimizer.input_count,
        output: s.optimizer.output_count,
        highlight: "optimizer" as const,
      },
      {
        key: "rel",
        label: "Reliability",
        input: s.reliability_engine.input_count,
        output: s.reliability_engine.output_count,
        highlight: "reliability" as const,
      },
    ];
  }, [stages]);

  const requestPreview = useMemo(() => {
    if (!lastRequest) return null;
    try {
      return JSON.stringify(lastRequest, null, 2);
    } catch {
      return null;
    }
  }, [lastRequest]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#2F2F2F]">Trace explorer</h1>
            <p className="mt-1 text-sm text-gray-600">
              Request to candidates, constraints, scores, diversity, optimizer, reliability, and final output. Raw execution trace is primary when dual traces exist.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex rounded-lg bg-gray-200 p-1">
              <button
                type="button"
                onClick={() => setView("safe")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${view === "safe" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Safe Trace
              </button>
              <button
                type="button"
                onClick={() => setView("execution")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${view === "execution" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Raw Execution
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void handleReplay();
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                Replay Decision
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void handleTestDeterminism();
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
              >
                Test Determinism
              </button>
              <span className="text-gray-300">|</span>
              <Link to="/app/system/reliability" className="text-[10px] font-bold uppercase tracking-wider text-[#7A6F4B] hover:underline">
                Reliability dashboard
              </Link>
            </div>
          </div>
        </div>

        {auditStatus ? (
          <div
            className={`mt-4 rounded-lg border px-4 py-2 text-xs font-medium ${
              auditStatus.startsWith("PASS")
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : auditStatus.startsWith("WARN")
                  ? "border-amber-100 bg-amber-50 text-amber-700"
                  : "border-red-100 bg-red-50 text-red-700"
            }`}
          >
            {auditStatus}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-wider text-gray-400">
          <span>Request ID: {plan.request_id}</span>
          <span>Trace ID: {trace.trace_id}</span>
          <span>Time: {formatTraceTime(trace.timestamp)}</span>
        </div>

      </header>

      <div className="eng-panel p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pipeline flow (output / input)</p>
        <TracePipelineStrip stages={pipelineStages} />
      </div>

      {requestPreview ? (
        <details className="rounded-2xl border border-[#E6E1D8] bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-[#2F2F2F]">Last DecisionRequest (session)</summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-[#FAF8F3] p-3 text-[11px] text-gray-800">{requestPreview}</pre>
        </details>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="1. Interpretation layer" isHealed={checkHealed("interpretation_layer")}>
          <StatItem
            label="ML used"
            value={String((stages.interpretation_layer as Record<string, unknown>).ml_used ?? false)}
            isChanged={checkStatHealed("interpretation_layer", "ml_used")}
          />
          <StatItem
            label="ML confidence"
            value={`${(Number((stages.interpretation_layer as Record<string, unknown>).ml_confidence ?? 0) * 100).toFixed(1)}%`}
            isChanged={checkStatHealed("interpretation_layer", "ml_confidence")}
          />
          <StatItem
            label="ML weight"
            value={Number((stages.interpretation_layer as Record<string, unknown>).ml_contribution_weight ?? 0)}
            isChanged={checkStatHealed("interpretation_layer", "ml_contribution_weight")}
          />
        </Section>

        <Section title="2. Candidate generation" isHealed={checkHealed("candidate_generator")}>
          <StatItem label="Input foods" value={stages.candidate_generator.input_count} isChanged={checkStatHealed("candidate_generator", "input_count")} />
          <StatItem label="Pool size" value={stages.candidate_generator.output_count} isChanged={checkStatHealed("candidate_generator", "output_count")} />
        </Section>

        <Section title="3. Constraints (P0 + rules)" isSafetyCore isHealed={checkHealed("constraint_engine")}>
          <StatItem label="Input" value={stages.constraint_engine.input_count} isChanged={checkStatHealed("constraint_engine", "input_count")} />
          <StatItem label="Output" value={stages.constraint_engine.output_count} isChanged={checkStatHealed("constraint_engine", "output_count")} />
          <StatItem label="Removed / rejected" value={stages.constraint_engine.rejected ?? 0} isChanged={checkStatHealed("constraint_engine", "rejected")} />
          <StatItem label="P0 rules checked" value={stages.constraint_engine.p0_rules_checked ?? 0} isChanged={checkStatHealed("constraint_engine", "p0_rules_checked")} />
          <StatItem label="P0 violations" value={stages.constraint_engine.p0_violations ?? 0} isChanged={checkStatHealed("constraint_engine", "p0_violations")} />
          {Array.isArray(stages.constraint_engine.p0_violated_rule_ids) && stages.constraint_engine.p0_violated_rule_ids.length > 0 ? (
            <p className="mt-2 text-xs text-red-700">
              P0 violated rule ids: {stages.constraint_engine.p0_violated_rule_ids.join(", ")}
            </p>
          ) : null}
          {hasSafetyViolations ? <p className="mt-2 text-[10px] font-bold uppercase italic text-red-600">Hard reject path exercised.</p> : null}
        </Section>

        <Section title="4. Scoring" isHealed={checkHealed("scoring_engine")}>
          <StatItem label="Input" value={stages.scoring_engine.input_count} isChanged={checkStatHealed("scoring_engine", "input_count")} />
          <StatItem label="Output" value={stages.scoring_engine.output_count} isChanged={checkStatHealed("scoring_engine", "output_count")} />
        </Section>

        <Section title="5. Diversity" isHealed={checkHealed("diversity_engine")}>
          <StatItem label="Input" value={stages.diversity_engine.input_count} isChanged={checkStatHealed("diversity_engine", "input_count")} />
          <StatItem label="Output" value={stages.diversity_engine.output_count} isChanged={checkStatHealed("diversity_engine", "output_count")} />
          <StatItem label="Historical matches" value={diversity.historical_matches_count ?? "—"} />
          <StatItem label="Diversity penalty" value={diversity.diversity_penalty_applied ?? "—"} />
        </Section>

        <Section title="6. Optimizer" isHealed={checkHealed("optimizer")}>
          <StatItem label="Input" value={stages.optimizer.input_count} isChanged={checkStatHealed("optimizer", "input_count")} />
          <StatItem label="Output meals" value={stages.optimizer.output_count} isChanged={checkStatHealed("optimizer", "output_count")} />
          <StatItem label="Combinations evaluated" value={stages.optimizer.combinations_evaluated ?? 0} isChanged={checkStatHealed("optimizer", "combinations_evaluated")} />
          <StatItem label="Selected score" value={`${(Number(stages.optimizer.selected_score ?? 0) * 100).toFixed(1)}%`} isChanged={checkStatHealed("optimizer", "selected_score")} />
        </Section>

        <Section title="7. Reliability" isHealed={checkHealed("reliability_engine")}>
          <StatItem label="Relaxation level" value={reliability.relaxation_level ?? 0} isChanged={checkStatHealed("reliability_engine", "relaxation_level")} />
          <StatItem label="Input" value={reliability.input_count} isChanged={checkStatHealed("reliability_engine", "input_count")} />
          <StatItem label="Output" value={reliability.output_count} isChanged={checkStatHealed("reliability_engine", "output_count")} />
          {Array.isArray(reliability.relaxed_priorities) && reliability.relaxed_priorities.length > 0 ? (
            <p className="mt-2 text-xs text-amber-800">Relaxed priorities: {reliability.relaxed_priorities.join(", ")}</p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No relaxed priorities recorded.</p>
          )}
          {reliability.confidence_eval && typeof reliability.confidence_eval === "object" ? (
            <div className="mt-3 space-y-1 border-t border-dashed border-gray-200 pt-2">
              <p className="text-[10px] font-bold uppercase text-gray-400">Confidence eval</p>
              {Object.entries(reliability.confidence_eval).map(([k, v]) => (
                <StatItem key={k} label={k} value={typeof v === "number" ? v.toFixed(3) : String(v)} />
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      <Section title="8. Rule firings">
        <div className="space-y-3">
          {stages.constraint_engine.rules && stages.constraint_engine.rules.length > 0 ? (
            stages.constraint_engine.rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                <div className={`mt-1 h-2 w-2 rounded-full ${rule.action === "reject" ? "bg-red-400" : "bg-amber-400"}`} />
                <div>
                  <div className="flex gap-2">
                    <span className="text-xs font-bold">{rule.rule_id}</span>
                    <span className="text-[10px] uppercase text-gray-400">{rule.action}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{rule.reason}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="italic text-gray-400">No rule rows on this trace (check raw JSON if you expected firings).</p>
          )}
        </div>
      </Section>

      <Section title="9. Output — meal plan & nutrition">
        <div className="space-y-2">
          {plan.meal_plan.map((m) => (
            <div key={m.recipe_id} className="flex justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="text-gray-500">
                {m.quantity?.value} {m.quantity?.unit}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <StatItem label="Calories" value={plan.nutrition_summary.calories} />
          <StatItem label="Protein" value={plan.nutrition_summary.protein} />
          <StatItem label="Carbs" value={plan.nutrition_summary.carbs} />
          <StatItem label="Fat" value={plan.nutrition_summary.fat} />
        </div>
        <div className="mt-3 text-xs text-gray-600">
          Response score: <span className="font-semibold">{plan.score}</span> · Confidence:{" "}
          <span className="font-semibold">{plan.confidence?.level}</span> ({plan.confidence?.value})
        </div>
        {plan.warnings?.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        {plan.insights?.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-gray-600">
            {plan.insights.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="10. Meta & timings">
        <StatItem label="Latency (server)" value={`${plan.meta.latency_ms} ms`} />
        {plan.meta.served_latency_ms != null ? <StatItem label="Served latency" value={`${plan.meta.served_latency_ms} ms`} /> : null}
        <StatItem label="Cache hit" value={String(plan.meta.cache_hit)} />
        <StatItem label="Model" value={plan.meta.model_version} />
        <StatItem label="Rules version" value={plan.meta.rules_version} />
      </Section>
    </div>
  );
}
