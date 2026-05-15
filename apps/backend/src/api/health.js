function envEnabled(name) {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return false;
  }

  return raw.trim().toLowerCase() === "true";
}

function redisStatus(check) {
  if (check && check.ok === true) {
    return "connected";
  }

  return "fallback";
}

function mlStatus(check) {
  if (check && check.ok === true) {
    return "connected";
  }

  return "unavailable";
}

function computeSystemOk(checks) {
  const safeChecks = checks && typeof checks === "object" ? checks : {};
  const dbOk = Boolean(safeChecks.db && safeChecks.db.ok === true);
  const redisRequired = envEnabled("USE_REDIS");
  const mlRequired = envEnabled("USE_ML");

  const redisOk = redisRequired ? Boolean(safeChecks.redis && safeChecks.redis.ok === true) : true;
  const aiOk = mlRequired ? Boolean(safeChecks.ai && safeChecks.ai.ok === true) : true;

  return dbOk && redisOk && aiOk;
}

function enrichHealthChecks(checks) {
  const safeChecks = checks && typeof checks === "object" ? checks : {};
  const enriched = {
    db: { ...(safeChecks.db || { ok: false }) },
    redis: { ...(safeChecks.redis || { ok: false }) },
    ai: { ...(safeChecks.ai || { ok: false }) },
  };

  if (!enriched.redis.ok) {
    enriched.redis.error = enriched.redis.error || `fallback_mode:${redisStatus(enriched.redis)}`;
  }

  if (!enriched.ai.ok) {
    enriched.ai.error = enriched.ai.error || `fallback_mode:${mlStatus(enriched.ai)}`;
  }

  return enriched;
}

module.exports = {
  envEnabled,
  redisStatus,
  mlStatus,
  computeSystemOk,
  enrichHealthChecks,
};

