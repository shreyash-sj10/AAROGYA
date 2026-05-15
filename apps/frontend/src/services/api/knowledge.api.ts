import { z } from "zod";
import { orchestrateQuery } from "@/ai/orchestrator";
import type { ApiResult } from "@/services/api/apiClient";

const knowledgeRequestSchema = z.object({
  query: z.string().min(1),
}).strict();

export const knowledgeResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string().min(1)),
  session_id: z.string().optional(),
  meta: z.object({
    fallback: z.boolean().optional(),
    reason: z.string().optional(),
    mode: z.string().optional(),
  }).optional(),
}).strict();

export type KnowledgeResponse = z.infer<typeof knowledgeResponseSchema>;

const CHAT_SESSION_KEY = "aarogya_chat_session_id";
let lastAssistantResponse = "";

function resolveChatSessionId(): string {
  if (typeof localStorage === "undefined") {
    return `chat_${crypto.randomUUID()}`;
  }

  const existing = localStorage.getItem(CHAT_SESSION_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated = `chat_${crypto.randomUUID()}`;
  localStorage.setItem(CHAT_SESSION_KEY, generated);
  return generated;
}

function isFollowUpQuery(query: string): boolean {
  return /\b(why|how|what does that mean)\b/i.test(query);
}

export async function sendChat(query: string): Promise<ApiResult<KnowledgeResponse>> {
  try {
    const input = knowledgeRequestSchema.parse({ query });
    const sessionId = resolveChatSessionId();

    const orchestration = await orchestrateQuery(input.query, {
      userContext: {
        session_id: sessionId,
        ...(isFollowUpQuery(input.query) && lastAssistantResponse
          ? { last_response: lastAssistantResponse }
          : {}),
      },
    });

    const answer = orchestration.text || "Can you clarify your question?";
    lastAssistantResponse = answer;

    return {
      data: {
        answer,
        sources: [],
        session_id: sessionId,
        meta: orchestration.meta,
      },
      error: null,
      meta: {
        status: 200,
        durationMs: 0,
      },
    };
  } catch {
    return {
      data: {
        answer: "Can you clarify your question?",
        sources: [],
        meta: {
          fallback: true,
          reason: "frontend_fallback",
          mode: "fallback",
        },
      },
      error: null,
      meta: {
        status: 200,
        durationMs: 0,
      },
    };
  }
}

export async function queryKnowledgeApi(query: string): Promise<ApiResult<KnowledgeResponse>> {
  return sendChat(query);
}
