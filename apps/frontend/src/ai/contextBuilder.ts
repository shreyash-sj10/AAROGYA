import { AIRequestType } from "./ai.contract";

type SafeRecord = Record<string, unknown>;

function toSafeObject(value: unknown): SafeRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SafeRecord)
    : {};
}

function toSafeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildExplainContext(decisionResponse: unknown) {
  const safeDecision = toSafeObject(decisionResponse);

  return {
    type: AIRequestType.EXPLAIN_DECISION,
    context: {
      user_profile: toSafeObject(safeDecision.user_profile),
      selected_meal: toSafeObject(safeDecision.selected_meal),
      rejected_foods: toSafeArray(safeDecision.rejected_foods),
      constraints_applied: toSafeObject(safeDecision.constraints_applied),
      decision_trace: toSafeObject(safeDecision.decision_trace || safeDecision.trace),
      trace: toSafeObject(safeDecision.trace),
      current_plan: toSafeObject(safeDecision.current_plan),
    },
  };
}

export function buildKnowledgeContext(query: string, user: unknown) {
  const safeUser = toSafeObject(user);

  return {
    type: AIRequestType.KNOWLEDGE_QUERY,
    query,
    context: {
      session_id: typeof safeUser.session_id === "string" ? safeUser.session_id : undefined,
      user_profile: toSafeObject(safeUser.user_profile || safeUser.profile),
      symptoms: toSafeArray(safeUser.symptoms),
      current_plan: toSafeObject(safeUser.current_plan || safeUser.plan),
      planner_reasoning: toSafeObject(safeUser.planner_reasoning || safeUser.trace),
      knowledge_docs: toSafeArray(safeUser.knowledge_docs),
      last_response: typeof safeUser.last_response === "string" ? safeUser.last_response : undefined,
      dosha: safeUser.dosha ?? null,
      conditions: safeUser.conditions ?? null,
    },
  };
}

export function buildSymptomContext(query: string) {
  return {
    type: AIRequestType.INTERPRET_SYMPTOMS,
    query,
    context: {
      raw_symptom_text: query,
    },
  };
}
