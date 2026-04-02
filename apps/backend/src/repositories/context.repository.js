const redis = require("../services/cache/redis.service");
const { logError } = require("../observability/logger");
const { recordError } = require("../observability/metrics");

const contextStore = new Map();

const logger = {
  error(message, meta = {}) {
    const safeMeta = meta && typeof meta === "object" ? meta : {};
    const errMessage = safeMeta.err instanceof Error ? safeMeta.err.message : "";

    logError({
      error_type: "SYSTEM_ERROR",
      message: errMessage ? `${message}: ${errMessage}` : message,
    });
  },
};

const metrics = {
  increment() {
    recordError("SYSTEM_ERROR");
  },
};

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultContext() {
  return {
    last_plan: null,
    user_state: {},
    last_intent: null,
  };
}

async function getContext(userId) {
  const id = toSafeString(userId, "anonymous");
  const key = `ctx:${id}`;

  const local = contextStore.get(id);
  if (local) {
    return clone(local);
  }

  const raw = await redis.get(key);
  if (!raw) {
    return defaultContext();
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? clone(parsed) : defaultContext();
  } catch (err) {
    logger.error("Context parse failure", { data: raw, err });
    metrics.increment("context_parse_error");
    if (typeof redis.del === "function") {
      await redis.del(key);
    } else {
      await redis.delete(key);
    }
    throw new Error("Corrupted context cache");
  }
}

function getContextSync(userId) {
  const id = toSafeString(userId, "anonymous");
  const local = contextStore.get(id);
  return local ? clone(local) : defaultContext();
}

async function saveContext(userId, value) {
  const id = toSafeString(userId, "anonymous");
  const safeValue = value && typeof value === "object" ? clone(value) : defaultContext();
  contextStore.set(id, safeValue);

  try {
    await redis.set(`ctx:${id}`, JSON.stringify(safeValue), 60 * 60);
  } catch (err) {
    logger.error("Context persistence failed", { err });
    metrics.increment("context_write_error");
    throw err;
  }

  return clone(safeValue);
}

function saveContextSync(userId, value) {
  const id = toSafeString(userId, "anonymous");
  const safeValue = value && typeof value === "object" ? clone(value) : defaultContext();
  contextStore.set(id, safeValue);
  redis.set(`ctx:${id}`, JSON.stringify(safeValue), 60 * 60).catch((err) => {
    logger.error("Context persistence failed", { err });
    metrics.increment("context_write_error");
  });
  return clone(safeValue);
}

module.exports = {
  getContext,
  getContextSync,
  saveContext,
  saveContextSync,
};
