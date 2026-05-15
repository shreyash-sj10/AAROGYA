const pg = require("../services/db/pg.service");
const { toSafeString } = require("../utils/safeUtils");

// Cache-only map. DB is source of truth.
const adherenceStore = new Map();
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.AAROGYA_ADHERENCE_CACHE_TTL_MS || 300000));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function key(userId, weekId) {
  return `${toSafeString(userId, "anonymous")}::${toSafeString(weekId, "")}`;
}

function setCache(cacheKey, value) {
  adherenceStore.set(cacheKey, {
    value: clone(value),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getCache(cacheKey) {
  const entry = adherenceStore.get(cacheKey);
  if (!entry || typeof entry !== "object") return null;
  if (Date.now() > Number(entry.expiresAt || 0)) {
    adherenceStore.delete(cacheKey);
    return null;
  }
  return clone(entry.value);
}

async function getAdherence(userId, weekId) {
  const uid = toSafeString(userId, "anonymous");
  const wid = toSafeString(weekId, "");

  const dbResult = await pg.query(
    "SELECT adherence_score, stats FROM user_weekly_adherence WHERE user_id = $1 AND week_id = $2 LIMIT 1",
    [uid, wid]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    const record = clone({
      user_id: uid,
      week_id: wid,
      adherence_score: dbResult.rows[0].adherence_score,
      stats: dbResult.rows[0].stats,
    });
    setCache(key(uid, wid), record);
    return record;
  }

  return null;
}

function getAdherenceSync(userId, weekId) {
  return getCache(key(userId, weekId));
}

async function upsertAdherence(record) {
  const safe = record && typeof record === "object" ? clone(record) : {};
  const uid = toSafeString(safe.user_id, "anonymous");
  const wid = toSafeString(safe.week_id, "");

  await pg.query(
    [
      "INSERT INTO user_weekly_adherence (user_id, week_id, adherence_score, stats)",
      "VALUES ($1, $2, $3, $4::jsonb)",
      "ON CONFLICT (user_id, week_id)",
      "DO UPDATE SET adherence_score = EXCLUDED.adherence_score, stats = EXCLUDED.stats",
    ].join(" "),
    [uid, wid, safe.adherence_score || 0, JSON.stringify(safe.stats || {})]
  );

  setCache(key(uid, wid), safe);
  return clone(safe);
}

function upsertAdherenceSync(record) {
  const safe = record && typeof record === "object" ? clone(record) : {};
  setCache(key(safe.user_id, safe.week_id), safe);
  return clone(safe);
}

async function listRecentAdherence(userId, limit = 10) {
  const uid = toSafeString(userId, "anonymous");
  const safeLimit = Math.max(1, Math.trunc(Number(limit) || 10));

  const dbResult = await pg.query(
    "SELECT user_id, week_id, adherence_score, stats FROM user_weekly_adherence WHERE user_id = $1 ORDER BY week_id DESC LIMIT $2",
    [uid, safeLimit]
  );

  const rows = Array.isArray(dbResult && dbResult.rows) ? dbResult.rows : [];
  rows.forEach((row) => setCache(key(row.user_id, row.week_id), row));
  return clone(rows);
}

module.exports = {
  getAdherence,
  getAdherenceSync,
  upsertAdherence,
  upsertAdherenceSync,
  listRecentAdherence,
};
