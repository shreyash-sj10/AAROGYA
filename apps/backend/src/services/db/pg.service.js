const PG_CONNECTION_STRING = process.env.DATABASE_URL || "";

let pool = null;

function isDbEnabled() {
  return Boolean(PG_CONNECTION_STRING);
}

function getPool() {
  if (pool) {
    return pool;
  }

  if (!isDbEnabled()) {
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
      connectionString: PG_CONNECTION_STRING,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 3000),
    });
    return pool;
  } catch (error) {
    throw new Error(`DB failure: pool initialization failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function query(text, values = []) {
  const activePool = getPool();

  try {
    return await activePool.query(text, values);
  } catch (error) {
    throw new Error(`DB failure: query failed (${error instanceof Error ? error.message : "unknown"})`);
  }
}

async function healthCheck() {
  const result = await query("SELECT 1 AS ok", []);
  return Boolean(result && result.rows && result.rows[0] && Number(result.rows[0].ok) === 1);
}

module.exports = {
  query,
  isDbEnabled,
  healthCheck,
};
