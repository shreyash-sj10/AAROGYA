import type { AIResponse } from "./ai.contract";

export function buildDeterministicExplanation(fallbackData: unknown): string {
  return `Deterministic fallback explanation: ${JSON.stringify(fallbackData ?? {})}`;
}

export function handleAIResponse(response: AIResponse | null, fallbackData: unknown): string {
  if (!response || response.error === "INSUFFICIENT_CONTEXT") {
    return buildDeterministicExplanation(fallbackData);
  }

  return response.data?.text ?? buildDeterministicExplanation(fallbackData);
}
