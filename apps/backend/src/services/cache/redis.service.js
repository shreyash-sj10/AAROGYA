const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client = null;
let connectPromise = null;

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function logRedisError(message, error) {
  const details = error instanceof Error ? error.message : "unknown";
  console.error(`[redis] ${message}: ${details}`);
}

async function getClient() {
  if (client) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      let redisLib = null;
      try {
        redisLib = require("redis");
      } catch (error) {
        logRedisError("library_load_failed", error);
        throw new Error("Redis failure: unable to load redis library");
      }

      try {
        const next = redisLib.createClient({ url: REDIS_URL });
        next.on("error", (err) => logRedisError("client_error", err));
        await next.connect();
        client = next;
        return client;
      } catch (error) {
        logRedisError("connect_failed", error);
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

  const redis = await getClient();

  try {
    return await redis.get(safeKey);
  } catch (error) {
    logRedisError("get_failed", error);
    throw new Error(`Redis failure: GET failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function set(key, value, ttlSeconds) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

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
    throw new Error(`Redis failure: SET failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function remove(key) {
  const safeKey = toSafeString(key);
  if (!safeKey) {
    throw new Error("Redis failure: key is required");
  }

  const redis = await getClient();

  try {
    await redis.del(safeKey);
    return true;
  } catch (error) {
    logRedisError("delete_failed", error);
    throw new Error(`Redis failure: DEL failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function healthCheck() {
  const redis = await getClient();
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (error) {
    logRedisError("ping_failed", error);
    throw new Error(`Redis failure: PING failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

module.exports = {
  get,
  set,
  delete: remove,
  healthCheck,
};
