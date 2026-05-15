const { simulateDbDown } = require("../../config/devSimulations");

let pool = null;
let activeConnectionString = "";

const PG_QUERY_RETRIES = Math.max(1, Math.min(8, Number(process.env.AAROGYA_PG_QUERY_RETRIES || 3)));

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function getConnectionString() {
  const value = process.env.DATABASE_URL || "";
  if (!value) {
    return "";
  }
  return value;
}

function isDbEnabled() {
  return Boolean(getConnectionString());
}

function getPool() {
  const connectionString = getConnectionString();

  if (pool) {
    if (activeConnectionString && activeConnectionString === connectionString) {
      return pool;
    }
    try {
      pool.end().catch(() => {});
    } catch (_error) {
      /* ignore */
    }
    pool = null;
    activeConnectionString = "";
  }

  if (!connectionString) {
    throw new Error("DB failure: DATABASE_URL is not configured");
  }

  let pgLib = null;
  try {
    pgLib = require("pg");
  } catch (error) {
    throw new Error(`DB failure: unable to load pg library (${error instanceof Error ? error.message : "unknown"})`);
  }

  try {
    pool = new pgLib.Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 3000),
    });
    activeConnectionString = connectionString;
    return pool;
  } catch (error) {
    throw new Error(`DB failure: pool initialization failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

function wrapPgError(error) {
  const wrapped = new Error(`DB failure: query failed (${error instanceof Error ? error.message : "unknown"})`);
  wrapped.cause = error;
  const code = error && typeof error === "object" && error.code ? String(error.code) : "";
  if (code) {
    wrapped.code = code;
  }
  return wrapped;
}

function isRetryablePgError(error) {
  const raw = error && error.cause && error.cause.code ? error.cause.code : error && error.code;
  const code = typeof raw === "string" ? raw : "";
  return (
    code === "08006"
    || code === "08003"
    || code === "08001"
    || code === "40001"
    || code === "40P01"
    || code === "57P01"
    || code === "57P02"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT"
  );
}

async function executeQueryOnce(text, values = []) {
  if (simulateDbDown()) {
    throw new Error("DB failure: simulated DB down (SIMULATE_DB_DOWN=true)");
  }
  const activePool = getPool();
  try {
    return await activePool.query(text, values);
  } catch (error) {
    throw wrapPgError(error);
  }
}

/**
 * Pool query with bounded retries for transient PostgreSQL / socket errors (Phase 4).
 */
async function query(text, values = []) {
  let lastError = null;
  for (let attempt = 1; attempt <= PG_QUERY_RETRIES; attempt += 1) {
    try {
      return await executeQueryOnce(text, values);
    } catch (error) {
      lastError = error;
      if (attempt >= PG_QUERY_RETRIES || !isRetryablePgError(error)) {
        throw error;
      }
      const backoff = Math.min(750, 40 * (2 ** (attempt - 1)));
      await sleep(backoff);
    }
  }
  throw lastError || new Error("DB failure: query failed after retries");
}

/**
 * Runs work inside a single DB transaction (Phase 4). Uses a dedicated client — no retry wrapper on each statement.
 * @param {(client: import("pg").PoolClient) => Promise<void>} fn
 */
async function withTransaction(fn) {
  if (simulateDbDown()) {
    throw new Error("DB failure: simulated DB down (SIMULATE_DB_DOWN=true)");
  }
  const activePool = getPool();
  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackErr) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

async function shutdownPool() {
  if (!pool) {
    return;
  }
  const toClose = pool;
  pool = null;
  activeConnectionString = "";
  try {
    await toClose.end();
  } catch (_e) {
    /* ignore */
  }
}

async function healthCheck() {
  const status = await getDatabaseHealth();
  return status.ok;
}

/**
 * Never throws. Used by /health so a down DB returns checks.db.ok=false instead of HTTP 500.
 */
async function getDatabaseHealth() {
  if (simulateDbDown()) {
    return { ok: false, error: "SIMULATE_DB_DOWN" };
  }
  if (!isDbEnabled()) {
    return { ok: false, error: "DATABASE_URL not configured" };
  }

  try {
    const result = await query("SELECT 1 AS ok", []);
    const ok = Boolean(result && result.rows && result.rows[0] && Number(result.rows[0].ok) === 1);
    if (!ok) {
      return { ok: false, error: "unexpected_db_health_result" };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message.slice(0, 500) };
  }
}

module.exports = {
  query,
  withTransaction,
  shutdownPool,
  isDbEnabled,
  healthCheck,
  getDatabaseHealth,
};
