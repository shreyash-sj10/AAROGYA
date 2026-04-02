const pg = require("../services/db/pg.service");

const stateStore = new Map();
const ALLOW_MEMORY_FALLBACK = process.env.AYUDIET_ALLOW_MEMORY_STATE_FALLBACK === "true";

function toSafeString(value) {
  return typeof value === "string" ? value : "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildKey(userId, date) {
  return `${toSafeString(userId)}::${toSafeString(date)}`;
}

function assertMemoryFallbackEnabled() {
  if (!ALLOW_MEMORY_FALLBACK) {
    throw new Error("State repository memory fallback is disabled. Set AYUDIET_ALLOW_MEMORY_STATE_FALLBACK=true only in dev mode.");
  }
}

async function getState(userId, date) {
  const dbResult = await pg.query(
    "SELECT state FROM daily_state WHERE user_id = $1 AND date = $2 LIMIT 1",
    [toSafeString(userId), toSafeString(date)]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    return clone(dbResult.rows[0].state || null);
  }

  if (!ALLOW_MEMORY_FALLBACK) {
    return null;
  }

  const key = buildKey(userId, date);
  return clone(stateStore.get(key) || null);
}

function getStateSync(userId, date) {
  assertMemoryFallbackEnabled();
  const key = buildKey(userId, date);
  return clone(stateStore.get(key) || null);
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

  if (ALLOW_MEMORY_FALLBACK) {
    const key = buildKey(safeState.user_id, safeState.date);
    stateStore.set(key, safeState);
  }

  return clone(safeState);
}

function saveStateSync(state) {
  assertMemoryFallbackEnabled();
  const safeState = state && typeof state === "object" ? clone(state) : {};
  const key = buildKey(safeState.user_id, safeState.date);
  stateStore.set(key, safeState);
  return clone(safeState);
}

module.exports = {
  getState,
  getStateSync,
  saveState,
  saveStateSync,
};
