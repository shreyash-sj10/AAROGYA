const { recordError } = require("../../observability/metrics");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.AYUDIET_REDIS_CONNECT_TIMEOUT_MS || 3000);
const REDIS_MAX_RECONNECT_RETRIES = Number(process.env.AYUDIET_REDIS_MAX_RECONNECT_RETRIES || 3);
const REDIS_CIRCUIT_COOLDOWN_MS = Number(process.env.AYUDIET_REDIS_CIRCUIT_COOLDOWN_MS || 30000);

let client = null;
let connectPromise = null;
let reconnectAttempts = 0;
let circuitOpenUntil = 0;

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowMs() {
  return Date.now();
}

function markCacheError() {
  recordError("CACHE_ERROR");
}

function logRedisError(message, error) {
  const details = error instanceof Error ? error.message : "unknown";
  console.error(`[redis] ${message}: ${details}`);
  markCacheError();
}

function openCircuit(reason) {
  circuitOpenUntil = nowMs() + Math.max(1000, REDIS_CIRCUIT_COOLDOWN_MS);
  logRedisError("circuit_open", new Error(reason));
}

function assertCircuitClosed() {
  if (circuitOpenUntil > nowMs()) {
    throw new Error("Redis failure: circuit open");
  }

  if (circuitOpenUntil > 0 && circuitOpenUntil <= nowMs()) {
    circuitOpenUntil = 0;
    reconnectAttempts = 0;
  }
}

async function getClient() {
  if (client) {
    return client;
  }

  assertCircuitClosed();

  if (!connectPromise) {
    connectPromise = (async () => {
      let redisLib = null;
      try {
        redisLib = require("redis");
      } catch (error) {
        logRedisError("library_load_failed", error);
        openCircuit("Redis failure: unable to load redis library");
        throw new Error("Redis failure: unable to load redis library");
      }

      try {
        const next = redisLib.createClient({
          url: REDIS_URL,
          socket: {
            connectTimeout: Math.max(100, REDIS_CONNECT_TIMEOUT_MS),
            reconnectStrategy(retries) {
              reconnectAttempts = retries;
              if (retries >= Math.max(0, REDIS_MAX_RECONNECT_RETRIES)) {
                openCircuit(`Redis failure: reconnect retries exceeded (${retries})`);
                return false;
              }
              return Math.min(1000 * (retries + 1), 3000);
            },
          },
        });

        next.on("error", (err) => logRedisError("client_error", err));
        await next.connect();

        reconnectAttempts = 0;
        circuitOpenUntil = 0;
        client = next;
        return client;
      } catch (error) {
        logRedisError("connect_failed", error);
        openCircuit(`Redis failure: connection failed (${error instanceof Error ? error.message : "unknown"})`);
        throw new Error(`Redis failure: connection failed (${error instanceof Error ? error.message : "unknown"})`);
      }
    })().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

async function get(key) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  assertCircuitClosed();
  const redis = await getClient();

  try {
    return await redis.get(safeKey);
  } catch (error) {
    logRedisError("get_failed", error);
    openCircuit(`Redis failure: GET failed (${error instanceof Error ? error.message : "unknown"})`);
    throw new Error(`Redis failure: GET failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function set(key, value, ttlSeconds) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  assertCircuitClosed();
  const redis = await getClient();

  try {
    if (typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      await redis.set(safeKey, value, { EX: Math.floor(ttlSeconds) });
    } else {
      await redis.set(safeKey, value);
    }

    return true;
  } catch (error) {
    logRedisError("set_failed", error);
    openCircuit(`Redis failure: SET failed (${error instanceof Error ? error.message : "unknown"})`);
    throw new Error(`Redis failure: SET failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function remove(key) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  assertCircuitClosed();
  const redis = await getClient();

  try {
    await redis.del(safeKey);
    return true;
  } catch (error) {
    logRedisError("delete_failed", error);
    openCircuit(`Redis failure: DEL failed (${error instanceof Error ? error.message : "unknown"})`);
    throw new Error(`Redis failure: DEL failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function healthCheck() {
  assertCircuitClosed();
  const redis = await getClient();
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (error) {
    logRedisError("ping_failed", error);
    openCircuit(`Redis failure: PING failed (${error instanceof Error ? error.message : "unknown"})`);
    throw new Error(`Redis failure: PING failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

module.exports = {
  get,
  set,
  delete: remove,
  healthCheck,
};
