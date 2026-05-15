import { AIRequestType } from "./ai.contract";

export function classifyIntent(query: string): AIRequestType {
  const text = (query || "").toLowerCase();

  if (/(what should i eat|diet plan)/i.test(text)) {
    return AIRequestType.INVALID_REQUEST;
  }

  if (/(why this meal|why selected|explain my plan)/i.test(text)) {
    return AIRequestType.EXPLAIN_DECISION;
  }

  if (/(what is|explain|why does)/i.test(text)) {
    return AIRequestType.KNOWLEDGE_QUERY;
  }

  if (/(i feel|symptom|pain|acidity|bloating)/i.test(text)) {
    return AIRequestType.INTERPRET_SYMPTOMS;
  }

  return AIRequestType.KNOWLEDGE_QUERY;
}
