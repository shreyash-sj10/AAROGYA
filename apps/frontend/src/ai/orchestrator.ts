import type { AIRequest, AIMeta } from "./ai.contract";
import { AIRequestType } from "./ai.contract";
import { classifyIntent } from "./intentClassifier";
import { buildKnowledgeContext, buildSymptomContext } from "./contextBuilder";
import { routeAI } from "./aiRouter";

type OrchestrateOptions = {
  userContext?: unknown;
};

export type OrchestrateResult = {
  intent: AIRequestType;
  request: AIRequest;
  text: string;
  meta: AIMeta;
};

export async function orchestrateQuery(query: string, options: OrchestrateOptions = {}): Promise<OrchestrateResult> {
  const intent = classifyIntent(query);

  let request: AIRequest;
  if (intent === AIRequestType.INTERPRET_SYMPTOMS) {
    const built = buildSymptomContext(query);
    request = {
      type: built.type,
      query: built.query,
      context: {
        ...built.context,
        ...((options.userContext as Record<string, unknown>) || {}),
      },
    };
  } else if (intent === AIRequestType.INVALID_REQUEST) {
    request = {
      type: AIRequestType.INVALID_REQUEST,
      query,
      context: ((options.userContext as Record<string, unknown>) || {}),
    };
  } else {
    const built = buildKnowledgeContext(query, options.userContext || {});
    request = {
      type: built.type,
      query: built.query,
      context: built.context,
    };
  }

  const response = await routeAI(request);
  const text = (response && response.data && response.data.text) || "Can you clarify your question?";
  const meta = response.meta || {
    fallback: true,
    reason: "orchestrator_fallback",
    mode: "fallback",
  };

  return {
    intent,
    request,
    text,
    meta,
  };
}
