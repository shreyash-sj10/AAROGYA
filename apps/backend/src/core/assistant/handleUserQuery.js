const { getRAGExplanation } = require("../../services/ml/ragClient");
const { buildFallbackProfile } = require("../../modules/ai/ai.profile.service");
const { toSafeObject, toSafeArray, toSafeString } = require("../../utils/safeUtils");

const DEFAULT_PROFILE_THRESHOLD = 0.6;
const SESSION_TTL_MS = 30 * 60 * 1000;
const FOLLOW_UP_REGEX = /\b(why|how|what does that mean)\b/i;

const chatSessions = new Map();

function now() {
  return Date.now();
}

function cleanupExpiredSessions() {
  const cutoff = now() - SESSION_TTL_MS;
  for (const [id, state] of chatSessions.entries()) {
    const safeState = toSafeObject(state);
    const updatedAt = Number.isFinite(safeState.updated_at) ? safeState.updated_at : 0;
    if (!updatedAt || updatedAt < cutoff) {
      chatSessions.delete(id);
    }
  }
}

function resolveSessionId(raw) {
  const explicit = toSafeString(raw);
  if (!explicit) {
    throw new Error("SESSION_ID_REQUIRED");
  }
  return explicit;
}

function readSession(sessionId) {
  cleanupExpiredSessions();
  const existing = toSafeObject(chatSessions.get(sessionId));
  if (existing.session_id) {
    return existing;
  }

  const created = {
    session_id: sessionId,
    profile: null,
    last_response: "",
    updated_at: now(),
  };
  chatSessions.set(sessionId, created);
  return created;
}

function writeSession(sessionId, patch) {
  const merged = {
    ...readSession(sessionId),
    ...toSafeObject(patch),
    updated_at: now(),
  };
  chatSessions.set(sessionId, merged);
  return merged;
}

function classifyIntent(query, userContext = {}) {
  const text = toSafeString(query).toLowerCase();
  if (!text) return "KNOWLEDGE_QUERY";

  const safeContext = toSafeObject(userContext);
  if (safeContext.force_explain === true) {
    return "EXPLAIN_DECISION";
  }

  if (/\b(why this meal|why selected|explain my plan|explain this meal|explain decision)\b/.test(text)) {
    return "EXPLAIN_DECISION";
  }

  if (/\b(i feel|i have|feeling|symptom|acidity|bloating|burning|constipation|gas|indigestion|fatigue|headache|nausea)\b/.test(text)) {
    return "INTERPRET_SYMPTOMS";
  }

  return "KNOWLEDGE_QUERY";
}

function buildRagPayload(query, userContext, sessionState) {
  const safeQuery = toSafeString(query);
  const safeContext = toSafeObject(userContext);
  const safeProfile = toSafeObject(sessionState.profile || safeContext.user_profile || safeContext.profile);

  const context = {
    user_profile: safeProfile,
    symptoms: {
      extracted_tags: toSafeArray(safeContext.symptoms || safeContext.extracted_tags),
      risk_flags: toSafeArray(safeProfile.risk_flags),
    },
    current_plan: toSafeObject(safeContext.current_plan || safeContext.plan),
  };

  const hasContext =
    Object.keys(toSafeObject(context.user_profile)).length > 0
    || toSafeArray(toSafeObject(context.symptoms).extracted_tags).length > 0
    || toSafeArray(toSafeObject(context.symptoms).risk_flags).length > 0
    || Object.keys(toSafeObject(context.current_plan)).length > 0;

  if (!safeQuery || !toSafeString(sessionState.session_id) || !hasContext) {
    throw new Error("INVALID_RAG_PAYLOAD");
  }

  const retrievedDocuments = {
    planner_reasoning: toSafeObject(safeContext.trace || safeContext.decision_trace || safeContext.planner_reasoning),
    knowledge_docs: toSafeArray(safeContext.knowledge_docs || safeContext.knowledge),
  };

  if (FOLLOW_UP_REGEX.test(safeQuery) && toSafeString(sessionState.last_response)) {
    context.last_response = toSafeString(sessionState.last_response);
  }

  return {
    query: safeQuery,
    session_id: toSafeString(sessionState.session_id),
    context,
    retrieved_documents: retrievedDocuments,
  };
}

function resolveMetaDefaults(meta, fallback = false, reason = "ok") {
  const safeMeta = toSafeObject(meta);
  return {
    fallback: Boolean(Object.prototype.hasOwnProperty.call(safeMeta, "fallback") ? safeMeta.fallback : fallback),
    reason: toSafeString(safeMeta.reason || reason) || reason,
    mode: toSafeString(safeMeta.mode || (fallback ? "fallback" : "normal")) || (fallback ? "fallback" : "normal"),
  };
}

function buildSafeFallback(reason) {
  const normalized = toSafeString(reason).toLowerCase();

  if (normalized === "no_context") {
    return {
      text: "Can you clarify your question?",
      meta: resolveMetaDefaults({ fallback: true, reason: "no_context", mode: "fallback" }, true, "no_context"),
    };
  }

  if (normalized === "safety_blocked") {
    return {
      text: "I cannot help with that request, but I can provide safe Ayurvedic guidance if you rephrase it.",
      meta: resolveMetaDefaults({ fallback: true, reason: "safety_blocked", mode: "fallback" }, true, "safety_blocked"),
    };
  }

  return {
    text: "I couldn't answer reliably right now. Please try asking in a more specific way.",
    meta: resolveMetaDefaults({ fallback: true, reason: normalized || "fallback_ui", mode: "fallback" }, true, normalized || "fallback_ui"),
  };
}

async function callRagWithMetaPolicy(payload) {
  const maxAttempts = 2;
  let retriedTimeout = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let rag;
    try {
      rag = await getRAGExplanation(payload);
    } catch (error) {
      const timeoutLike = error instanceof Error && /timeout/i.test(error.message);
      if (timeoutLike && attempt < maxAttempts) {
        retriedTimeout = true;
        continue;
      }
      return buildSafeFallback(timeoutLike ? "timeout_retry" : "rag_failure");
    }

    const safeRag = toSafeObject(rag);
    const meta = resolveMetaDefaults(toSafeObject(safeRag.meta), false, "ok");
    const text = toSafeString(safeRag.explanation);

    if (meta.fallback && meta.reason === "timeout" && attempt < maxAttempts) {
      retriedTimeout = true;
      continue;
    }

    if (meta.fallback) {
      if (meta.reason === "timeout" && retriedTimeout) {
        return buildSafeFallback("timeout_retry");
      }
      return buildSafeFallback(meta.reason);
    }

    if (!text) {
      return buildSafeFallback("no_context");
    }

    return {
      text,
      meta: retriedTimeout
        ? resolveMetaDefaults({ ...meta, reason: "timeout_retry" }, meta.fallback, "timeout_retry")
        : meta,
    };
  }

  return buildSafeFallback("timeout_retry");
}

async function resolveProfileIfNeeded(intent, query, userContext, sessionState) {
  if (intent !== "INTERPRET_SYMPTOMS") {
    return sessionState;
  }

  const safeContext = toSafeObject(userContext);
  const threshold = Number.isFinite(safeContext.profile_threshold)
    ? Math.max(0, Math.min(1, safeContext.profile_threshold))
    : DEFAULT_PROFILE_THRESHOLD;

  const profile = buildFallbackProfile({ userInput: query, threshold });
  return writeSession(sessionState.session_id, { profile });
}

function enforceFollowUpContext(query, text, sessionState) {
  const safeQuery = toSafeString(query);
  if (!FOLLOW_UP_REGEX.test(safeQuery)) {
    return {
      text: toSafeString(text),
      meta: null,
    };
  }

  const previous = toSafeString(sessionState.last_response);
  if (!previous) {
    return {
      text: "Can you clarify your question?",
      meta: resolveMetaDefaults({ fallback: true, reason: "no_context", mode: "fallback" }, true, "no_context"),
    };
  }

  return {
    text: `Following up on my previous answer: ${previous}\n\n${toSafeString(text)}`,
    meta: null,
  };
}

function buildExplainText(userContext) {
  const safeContext = toSafeObject(userContext);
  const trace = toSafeObject(safeContext.trace || safeContext.decision_trace);
  const selectedMeal = toSafeObject(safeContext.selected_meal || toSafeObject(safeContext.current_plan).selected_meal);
  const constraints = toSafeObject(safeContext.constraints_applied || toSafeObject(safeContext.current_plan).constraints_applied);

  const mealName = toSafeString(selectedMeal.name, "the selected meal");
  const items = toSafeArray(selectedMeal.items).map((item) => toSafeString(item)).filter(Boolean);
  const dietType = toSafeString(constraints.diet_type, "your constraints");
  const traceHint = Object.keys(trace).length > 0
    ? "The decision trace confirms this aligns with planner scoring and guardrails."
    : "The planner context is limited, so this is based on available meal and constraint signals.";

  const itemSentence = items.length > 0
    ? `It was selected to balance digestibility and suitability across items such as ${items.slice(0, 3).join(", ")}.`
    : "It was selected to balance digestibility and suitability for your current state.";

  return `This is why ${mealName} was selected for ${dietType}. ${itemSentence} ${traceHint}`;
}

async function handleUserQuery(query, userContext = {}) {
  const safeContext = toSafeObject(userContext);
  const sessionId = resolveSessionId(safeContext.session_id || safeContext.sessionId || safeContext.chat_session_id);
  let sessionState = readSession(sessionId);

  const safeQuery = toSafeString(query);
  const intent = classifyIntent(safeQuery, safeContext);

  if (intent === "EXPLAIN_DECISION") {
    const text = buildExplainText(safeContext);
    writeSession(sessionId, { last_response: text, profile: sessionState.profile });
    return {
      intent,
      routed_endpoint: "/ai/explain",
      text,
      session_id: sessionId,
      meta: resolveMetaDefaults({ fallback: false, reason: "ok", mode: "normal" }, false, "ok"),
    };
  }

  sessionState = await resolveProfileIfNeeded(intent, safeQuery, safeContext, sessionState);

  let ragPayload;
  try {
    ragPayload = buildRagPayload(safeQuery, safeContext, sessionState);
  } catch (error) {
    const invalid = error instanceof Error && error.message === "INVALID_RAG_PAYLOAD";
    const fallback = buildSafeFallback(invalid ? "no_context" : "rag_failure");
    writeSession(sessionId, { last_response: fallback.text, profile: sessionState.profile });
    return {
      intent,
      routed_endpoint: "/ai/rag",
      text: fallback.text,
      session_id: sessionId,
      meta: fallback.meta,
    };
  }

  const ragResult = await callRagWithMetaPolicy(ragPayload);
  const followUp = enforceFollowUpContext(safeQuery, ragResult.text, sessionState);
  const finalText = followUp.text;
  const finalMeta = followUp.meta || ragResult.meta;

  writeSession(sessionId, {
    profile: sessionState.profile,
    last_response: finalText,
  });

  return {
    intent,
    routed_endpoint: "/ai/rag",
    text: finalText,
    session_id: sessionId,
    meta: finalMeta,
  };
}

module.exports = {
  handleUserQuery,
};
