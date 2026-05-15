const crypto = require("crypto");
const FEATURE_FLAGS = require("../../config/featureFlags");
const cache = require("../cache/cache.service");
const { recordError } = require("../../observability/metrics");

const DEFAULT_AI_SERVICE_URL = "https://aarogya-llm-model.onrender.com";
const TIMEOUT_MS = Number(process.env.AAROGYA_RAG_TIMEOUT_MS || 5000);
const MAX_RETRIES = Number(process.env.AAROGYA_RAG_RETRIES || 1);

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimSlash(value) {
  return toSafeString(value).replace(/\/+$/, "");
}

function resolveRagUrl() {
  const explicit = trimSlash(process.env.AAROGYA_RAG_URL || "");
  if (explicit) {
    return explicit.endsWith("/ai/rag") ? explicit : `${explicit}/ai/rag`;
  }

  const base = trimSlash(process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL);
  return `${base}/ai/rag`;
}

const RAG_URL = resolveRagUrl();

function reportRAGWarning(message, error, extra = {}) {
  const errMessage = error instanceof Error ? error.message : String(error || "unknown");
  console.warn(`[rag] ${message}: ${errMessage}`);
  recordError("AI_FAILURE");
  return { ...toSafeObject(extra), error: errMessage };
}

function assertValidRagPayload(payload) {
  const safe = toSafeObject(payload);
  const query = toSafeString(safe.query);
  const sessionId = toSafeString(safe.session_id);
  const context = toSafeObject(safe.context);

  if (!query || !sessionId || Object.keys(context).length === 0) {
    const error = new Error("INVALID_RAG_PAYLOAD");
    error.name = "InvalidRagPayloadError";
    throw error;
  }

  return {
    query,
    session_id: sessionId,
    context,
    retrieved_documents: toSafeObject(safe.retrieved_documents),
  };
}

function normalizeSources(rawSources) {
  return toSafeArray(rawSources)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      text_id: toSafeString(item.text_id),
      source: toSafeString(item.source),
      chapter: toSafeString(item.chapter),
    }))
    .filter((item) => item.text_id && item.source);
}

function normalizeEnvelope(parsed) {
  const safe = toSafeObject(parsed);
  const data = toSafeObject(safe.data);
  const meta = toSafeObject(safe.meta);

  return {
    explanation: toSafeString(data.explanation || safe.explanation),
    sources: normalizeSources(data.sources || safe.sources),
    meta: {
      fallback: Boolean(meta.fallback || safe.fallback_used),
      reason: toSafeString(meta.reason || safe.reason || "ok") || "ok",
      mode: toSafeString(meta.mode || "normal") || "normal",
    },
  };
}

function buildCacheKey(payload) {
  return `rag:${crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex")}`;
}

async function fetchWithTimeout(body) {
  let lastError = null;

  for (let attempt = 0; attempt <= Math.max(0, MAX_RETRIES); attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(500, TIMEOUT_MS));

    try {
      const response = await fetch(RAG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = new Error(`RAG_HTTP_${response.status}`);
        continue;
      }

      const parsed = await response.json();
      return normalizeEnvelope(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "unknown"));
      reportRAGWarning("RAG fetch attempt failed", lastError, { attempt, rag_url: RAG_URL });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw (lastError || new Error("RAG_REQUEST_FAILED"));
}

async function getRAGExplanation(input) {
  const payload = assertValidRagPayload(input);
  const key = buildCacheKey(payload);

  try {
    const cached = cache.get(key, { optional: true });
    if (cached && typeof cached === "object") {
      return cached;
    }
  } catch (error) {
    reportRAGWarning("RAG cache read failed", error, { key });
  }

  let result;

  if (FEATURE_FLAGS.useRAG) {
    try {
      result = await fetchWithTimeout(payload);
    } catch (error) {
      result = {
        explanation: "",
        sources: [],
        meta: {
          fallback: true,
          reason: error instanceof Error && /abort|timeout/i.test(error.message) ? "timeout" : "error",
          mode: "fallback",
        },
      };
    }
  } else {
    result = {
      explanation: "",
      sources: [],
      meta: {
        fallback: true,
        reason: "rag_disabled",
        mode: "fallback",
      },
    };
  }

  try {
    cache.set(key, result);
  } catch (error) {
    reportRAGWarning("RAG cache write failed", error, { key });
  }

  return result;
}

module.exports = {
  getRAGExplanation,
};
