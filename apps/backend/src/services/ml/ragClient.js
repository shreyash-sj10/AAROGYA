const crypto = require("crypto");
const FEATURE_FLAGS = require("../../config/featureFlags");
const cache = require("../cache/cache.service");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

const RAG_URL = process.env.AYUDIET_RAG_URL || "http://localhost:8000/rag/explain";
const TIMEOUT_MS = 3000;
const MAX_RETRIES = 1;

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function reportRAGFailure(message, error, extra = {}) {
  const errMessage = error instanceof Error ? error.message : String(error || "unknown");
  const safeExtra = extra && typeof extra === "object" ? extra : {};

  logError({
    error_type: "AI_FAILURE",
    message: `${message}: ${errMessage}`,
  });
  recordError("AI_FAILURE");

  return {
    ...safeExtra,
    error: errMessage,
  };
}

async function fetchWithTimeout(body) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(RAG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = new Error(`RAG HTTP ${response.status}`);
        reportRAGFailure("RAG request returned non-OK status", lastError, { attempt });
        continue;
      }

      const parsed = await response.json();
      if (parsed && typeof parsed === "object") {
        return parsed;
      }

      lastError = new Error("RAG response is not an object");
      reportRAGFailure("RAG response shape invalid", lastError, { attempt });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "unknown"));
      reportRAGFailure("RAG fetch attempt failed", lastError, { attempt });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw (lastError || new Error("RAG request failed"));
}

async function getRAGExplanation(query) {
  const safeQuery = toSafeString(query);

  if (!FEATURE_FLAGS.useRAG || !safeQuery) {
    return null;
  }

  const queryHash = crypto.createHash("sha1").update(safeQuery).digest("hex");
  const key = `rag:${queryHash}`;

  try {
    const cached = cache.get(key, { optional: true });
    if (cached && typeof cached === "object") {
      return cached;
    }
  } catch (error) {
    reportRAGFailure("RAG cache read failed", error, { key });
  }

  let parsed = null;
  try {
    parsed = await fetchWithTimeout({ query: safeQuery });
  } catch (error) {
    reportRAGFailure("RAG fetch exhausted retries", error, { query_hash: queryHash });
    return null;
  }

  const explanation = toSafeString(parsed.explanation);
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        text_id: typeof item.text_id === "string" ? item.text_id.trim() : "",
        source: typeof item.source === "string" ? item.source.trim() : "",
        chapter: typeof item.chapter === "string" ? item.chapter.trim() : "",
      }))
      .filter((item) => item.text_id && item.source)
    : [];

  if (!explanation) {
    reportRAGFailure("RAG explanation missing", new Error("empty_explanation"), { query_hash: queryHash });
    return null;
  }

  const result = {
    explanation,
    sources,
  };

  try {
    cache.set(key, result);
  } catch (error) {
    reportRAGFailure("RAG cache write failed", error, { key });
  }

  return result;
}

module.exports = {
  getRAGExplanation,
};
