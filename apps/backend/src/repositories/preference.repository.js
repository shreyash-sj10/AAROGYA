const pg = require("../services/db/pg.service");

// Cache-only map. DB is source of truth.
const preferenceStore = new Map();
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.AAROGYA_PREF_CACHE_TTL_MS || 300000));

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setCache(id, weights) {
  preferenceStore.set(id, {
    value: clone(weights),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getCache(id) {
  const entry = preferenceStore.get(id);
  if (!entry || typeof entry !== "object") return null;
  if (Date.now() > Number(entry.expiresAt || 0)) {
    preferenceStore.delete(id);
    return null;
  }
  return clone(entry.value);
}

async function getPreference(userId) {
  const id = toSafeString(userId, "anonymous");

  const dbResult = await pg.query(
    "SELECT weights FROM preferences WHERE user_id = $1 LIMIT 1",
    [id]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    const weights = clone(dbResult.rows[0].weights || null);
    if (weights && typeof weights === "object") {
      setCache(id, weights);
    }
    return weights;
  }

  return null;
}

function getPreferenceSync(userId) {
  const id = toSafeString(userId, "anonymous");
  return getCache(id);
}

async function upsertPreference(userId, weights) {
  const id = toSafeString(userId, "anonymous");
  const safeWeights = weights && typeof weights === "object" ? clone(weights) : {};

  await pg.query(
    [
      "INSERT INTO preferences (user_id, weights)",
      "VALUES ($1, $2::jsonb)",
      "ON CONFLICT (user_id) DO UPDATE SET weights = EXCLUDED.weights",
    ].join(" "),
    [id, JSON.stringify(safeWeights)]
  );

  setCache(id, safeWeights);
  return clone(safeWeights);
}

function upsertPreferenceSync(userId, weights) {
  const id = toSafeString(userId, "anonymous");
  const safeWeights = weights && typeof weights === "object" ? clone(weights) : {};
  setCache(id, safeWeights);
  return clone(safeWeights);
}

module.exports = {
  getPreference,
  getPreferenceSync,
  upsertPreference,
  upsertPreferenceSync,
};
