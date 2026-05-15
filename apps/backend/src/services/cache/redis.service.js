const { recordError } = require("../../observability/metrics");

const USE_REDIS = String(process.env.USE_REDIS ?? (process.env.NODE_ENV === "production" ? "true" : "false")).trim().toLowerCase() !== "false";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.AAROGYA_REDIS_CONNECT_TIMEOUT_MS || 3000);
const REDIS_MAX_CONNECT_RETRIES = Number(process.env.AAROGYA_REDIS_MAX_CONNECT_RETRIES || 3);
const REDIS_BACKOFF_BASE_MS = Number(process.env.AAROGYA_REDIS_BACKOFF_BASE_MS || 150);

let client = null;
let connectPromise = null;
let isRedisAvailable = false;
let redisMode = USE_REDIS ? "fallback" : "disabled";
let lastRedisError = USE_REDIS ? "redis_not_initialized" : "redis_disabled_by_env";

const memoryStore = new Map();

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowMs() {
  return Date.now();
}

function markCacheError() {
  recordError("CACHE_ERROR");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function logRedisIntent(event, details = "") {
  if (details) {
    console.error(`[redis] ${event}: ${details}`);
  } else {
    console.error(`[redis] ${event}`);
  }
}

function setFallbackMode(reason) {
  isRedisAvailable = false;
  redisMode = "fallback";
  lastRedisError = reason;
  logRedisIntent("fallback_to_memory_cache", reason);
  markCacheError();
}

function setConnectedMode() {
  isRedisAvailable = true;
  redisMode = "connected";
  lastRedisError = "";
}

function upsertMemory(key, value, ttlSeconds) {
  const ttlMs = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Math.floor(ttlSeconds * 1000)
    : 0;

  memoryStore.set(key, {
    value,
    expiresAt: ttlMs > 0 ? nowMs() + ttlMs : 0,
  });
}

function readMemory(key) {
  const hit = memoryStore.get(key);
  if (!hit) {
    return null;
  }

  if (hit.expiresAt > 0 && hit.expiresAt <= nowMs()) {
    memoryStore.delete(key);
    return null;
  }

  return hit.value;
}

function deleteMemory(key) {
  memoryStore.delete(key);
}

async function tryConnectRedis() {
  let redisLib = null;
  try {
    redisLib = require("redis");
  } catch (error) {
    setFallbackMode(`Redis failure: unable to load redis library (${error instanceof Error ? error.message : "unknown"})`);
    return null;
  }

  for (let attempt = 1; attempt <= Math.max(1, REDIS_MAX_CONNECT_RETRIES); attempt += 1) {
    try {
      const next = redisLib.createClient({
        url: REDIS_URL,
        socket: {
          connectTimeout: Math.max(100, REDIS_CONNECT_TIMEOUT_MS),
          reconnectStrategy() {
            return false;
          },
        },
      });

      next.on("error", (err) => {
        const reason = `Redis failure: client error (${err instanceof Error ? err.message : "unknown"})`;
        setFallbackMode(reason);
      });

      await next.connect();
      client = next;
      setConnectedMode();
      return client;
    } catch (error) {
      const reason = `Redis failure: connect attempt ${attempt} failed (${error instanceof Error ? error.message : "unknown"})`;
      logRedisIntent("connect_retry", reason);

      if (attempt >= Math.max(1, REDIS_MAX_CONNECT_RETRIES)) {
        setFallbackMode(`Redis failure: reconnect retries exceeded (${attempt})`);
        break;
      }

      const backoff = REDIS_BACKOFF_BASE_MS * (2 ** (attempt - 1));
      await sleep(backoff);
    }
  }

  return null;
}

async function getClient() {
  if (!USE_REDIS) {
    redisMode = "disabled";
    isRedisAvailable = false;
    lastRedisError = "redis_disabled_by_env";
    return null;
  }

  if (client && isRedisAvailable) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = tryConnectRedis().finally(() => {
      connectPromise = null;
    });
  }

  return connectPromise;
}

async function get(key) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  const redis = await getClient();
  if (!redis || !isRedisAvailable) {
    return readMemory(safeKey);
  }

  try {
    return await redis.get(safeKey);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    setFallbackMode(`Redis failure: GET failed (${msg})`);
    try {
      if (redis && typeof redis.quit === "function") {
        await redis.quit();
      }
    } catch (_quitErr) {
      /* ignore */
    }
    client = null;
    isRedisAvailable = false;
    return readMemory(safeKey);
  }
}

async function set(key, value, ttlSeconds) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  const redis = await getClient();
  if (!redis || !isRedisAvailable) {
    upsertMemory(safeKey, value, ttlSeconds);
    return true;
  }

  try {
    if (typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      await redis.set(safeKey, value, { EX: Math.floor(ttlSeconds) });
    } else {
      await redis.set(safeKey, value);
    }
    return true;
  } catch (error) {
    setFallbackMode(`Redis failure: SET failed (${error instanceof Error ? error.message : "unknown"})`);
    upsertMemory(safeKey, value, ttlSeconds);
    return true;
  }
}

async function remove(key) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  const redis = await getClient();
  if (!redis || !isRedisAvailable) {
    deleteMemory(safeKey);
    return true;
  }

  try {
    await redis.del(safeKey);
    return true;
  } catch (error) {
    setFallbackMode(`Redis failure: DEL failed (${error instanceof Error ? error.message : "unknown"})`);
    deleteMemory(safeKey);
    return true;
  }
}

async function healthCheck() {
  if (!USE_REDIS) {
    return false;
  }

  const redis = await getClient();
  if (!redis || !isRedisAvailable) {
    return false;
  }

  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (error) {
    setFallbackMode(`Redis failure: PING failed (${error instanceof Error ? error.message : "unknown"})`);
    return false;
  }
}

function getHealthStatus() {
  return {
    ok: isRedisAvailable,
    mode: redisMode,
    error: lastRedisError,
  };
}

async function shutdownRedis() {
  if (!client) {
    return;
  }
  const c = client;
  client = null;
  isRedisAvailable = false;
  redisMode = USE_REDIS ? "fallback" : "disabled";
  try {
    if (typeof c.quit === "function") {
      await c.quit();
    }
  } catch (_e) {
    /* ignore */
  }
}

module.exports = {
  get,
  set,
  delete: remove,
  healthCheck,
  getHealthStatus,
  shutdownRedis,
};

