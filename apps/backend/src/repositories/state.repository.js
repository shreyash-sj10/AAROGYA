const pg = require("../services/db/pg.service");

// Cache-only map. DB is source of truth.
const stateStore = new Map();
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.AAROGYA_STATE_CACHE_TTL_MS || 300000));

function toSafeString(value) {
  return typeof value === "string" ? value : "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildKey(userId, date) {
  return `${toSafeString(userId)}::${toSafeString(date)}`;
}

function setCache(key, state) {
  stateStore.set(key, {
    value: clone(state),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getCache(key) {
  const entry = stateStore.get(key);
  if (!entry || typeof entry !== "object") return null;
  if (Date.now() > Number(entry.expiresAt || 0)) {
    stateStore.delete(key);
    return null;
  }
  return clone(entry.value);
}

async function getState(userId, date) {
  const uid = toSafeString(userId);
  const day = toSafeString(date);

  const dbResult = await pg.query(
    "SELECT state FROM daily_state WHERE user_id = $1 AND date = $2 LIMIT 1",
    [uid, day]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    const value = clone(dbResult.rows[0].state || null);
    if (value) {
      setCache(buildKey(uid, day), value);
    }
    return value;
  }

  return null;
}

function getStateSync(userId, date) {
  return getCache(buildKey(userId, date));
}

async function saveState(state) {
  const safeState = state && typeof state === "object" ? clone(state) : {};

  await pg.query(
    [
      "INSERT INTO daily_state (user_id, date, state)",
      "VALUES ($1, $2, $3::jsonb)",
      "ON CONFLICT (user_id, date) DO UPDATE SET state = EXCLUDED.state",
    ].join(" "),
    [toSafeString(safeState.user_id), toSafeString(safeState.date), JSON.stringify(safeState)]
  );

  setCache(buildKey(safeState.user_id, safeState.date), safeState);
  return clone(safeState);
}

function saveStateSync(state) {
  const safeState = state && typeof state === "object" ? clone(state) : {};
  setCache(buildKey(safeState.user_id, safeState.date), safeState);
  return clone(safeState);
}

module.exports = {
  getState,
  getStateSync,
  saveState,
  saveStateSync,
};
