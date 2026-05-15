export enum AIRequestType {
  EXPLAIN_DECISION = "EXPLAIN_DECISION",
  KNOWLEDGE_QUERY = "KNOWLEDGE_QUERY",
  INTERPRET_SYMPTOMS = "INTERPRET_SYMPTOMS",
  INVALID_REQUEST = "INVALID_REQUEST",
}

export interface AIRequest {
  type: AIRequestType;
  query?: string;
  context?: Record<string, any>;
}

export interface AIMeta {
  fallback?: boolean;
  reason?: string;
  mode?: string;
}

export interface AIResponse {
  success: boolean;
  data?: { text: string };
  error?: string | null;
  meta?: AIMeta;
}
