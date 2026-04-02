const pg = require("../services/db/pg.service");

const preferenceStore = new Map();

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function getPreference(userId) {
  const id = toSafeString(userId, "anonymous");

  const dbResult = await pg.query(
    "SELECT weights FROM preferences WHERE user_id = $1 LIMIT 1",
    [id]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    return clone(dbResult.rows[0].weights || null);
  }

  return clone(preferenceStore.get(id) || null);
}

function getPreferenceSync(userId) {
  const id = toSafeString(userId, "anonymous");
  return clone(preferenceStore.get(id) || null);
}

async function upsertPreference(userId, weights) {
  const id = toSafeString(userId, "anonymous");
  const safeWeights = weights && typeof weights === "object" ? clone(weights) : {};

  preferenceStore.set(id, safeWeights);

  await pg.query(
    [
      "INSERT INTO preferences (user_id, weights)",
      "VALUES ($1, $2::jsonb)",
      "ON CONFLICT (user_id) DO UPDATE SET weights = EXCLUDED.weights",
    ].join(" "),
    [id, JSON.stringify(safeWeights)]
  );

  return clone(safeWeights);
}

function upsertPreferenceSync(userId, weights) {
  const id = toSafeString(userId, "anonymous");
  const safeWeights = weights && typeof weights === "object" ? clone(weights) : {};
  preferenceStore.set(id, safeWeights);
  return clone(safeWeights);
}

module.exports = {
  getPreference,
  getPreferenceSync,
  upsertPreference,
  upsertPreferenceSync,
};
