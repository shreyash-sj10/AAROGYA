const redis = require("./redis.service");
const { recordError } = require("../../observability/metrics");

const localCache = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function logCacheError(operation, key, error, extra = {}) {
  const details = error instanceof Error ? error.message : String(error || "unknown");
  console.error(JSON.stringify({
    level: "error",
    event: "cache_failure",
    operation,
    key,
    error: details,
    ...extra,
  }));
}

function metricError(type) {
  recordError(type === "parse" ? "CACHE_PARSE_ERROR" : "CACHE_ERROR");
}

function safeClone(value, operation, key) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    logCacheError(operation, key, error, { reason: "clone_failed" });
    metricError("cache");
    throw new Error("Cache failure");
  }
}

function ensureKey(key, operation) {
  if (typeof key === "string" && key.trim()) {
    return key.trim();
  }

  const error = new Error("key is required");
  logCacheError(operation, String(key || ""), error, { reason: "invalid_key" });
  metricError("cache");
  throw new Error("Cache failure");
}

function getLocal(key) {
  const local = localCache.get(key);
  if (!local) {
    return null;
  }

  if (local.expires_at <= nowSeconds()) {
    localCache.delete(key);
    return null;
  }

  return safeClone(local.value, "get_local", key);
}

async function get(key) {
  const safeKey = ensureKey(key, "get");
  const localValue = getLocal(safeKey);
  if (localValue !== null) {
    return localValue;
  }

  let raw = null;
  try {
    raw = await redis.get(safeKey);
  } catch (error) {
    logCacheError("get", safeKey, error);
    metricError("cache");
    throw new Error("Cache failure");
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return safeClone(parsed, "get_remote", safeKey);
  } catch (error) {
    logCacheError("get", safeKey, error, { reason: "parse_failed" });
    metricError("parse");
    throw new Error("Invalid cache data");
  }
}

function getSync(key) {
  const safeKey = ensureKey(key, "getSync");
  return getLocal(safeKey);
}

async function set(key, value, ttlSeconds) {
  const safeKey = ensureKey(key, "set");
  const ttl = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) ? Math.max(1, Math.floor(ttlSeconds)) : 300;
  const cloned = safeClone(value, "set", safeKey);

  localCache.set(safeKey, {
    value: cloned,
    expires_at: nowSeconds() + ttl,
  });

  try {
    await redis.set(safeKey, JSON.stringify(cloned), ttl);
  } catch (error) {
    logCacheError("set", safeKey, error);
    metricError("cache");
    throw new Error("Cache failure");
  }

  return safeClone(cloned, "set_return", safeKey);
}

function setSync(key, value, ttlSeconds) {
  const safeKey = ensureKey(key, "setSync");
  const ttl = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) ? Math.max(1, Math.floor(ttlSeconds)) : 300;
  const cloned = safeClone(value, "setSync", safeKey);

  localCache.set(safeKey, {
    value: cloned,
    expires_at: nowSeconds() + ttl,
  });

  redis.set(safeKey, JSON.stringify(cloned), ttl).catch((error) => {
    logCacheError("setSync", safeKey, error);
    metricError("cache");
  });

  return safeClone(cloned, "setSync_return", safeKey);
}

async function remove(key) {
  const safeKey = ensureKey(key, "delete");
  localCache.delete(safeKey);

  try {
    await redis.delete(safeKey);
  } catch (error) {
    logCacheError("delete", safeKey, error);
    metricError("cache");
    throw new Error("Cache failure");
  }

  return true;
}

module.exports = {
  get,
  getSync,
  set,
  setSync,
  delete: remove,
};
