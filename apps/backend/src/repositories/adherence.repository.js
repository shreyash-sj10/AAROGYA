const pg = require("../services/db/pg.service");

const adherenceStore = new Map();

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function key(userId, weekId) {
  return `${toSafeString(userId, "anonymous")}::${toSafeString(weekId, "")}`;
}

async function getAdherence(userId, weekId) {
  const uid = toSafeString(userId, "anonymous");
  const wid = toSafeString(weekId, "");

  const dbResult = await pg.query(
    "SELECT adherence_score, stats FROM user_weekly_adherence WHERE user_id = $1 AND week_id = $2 LIMIT 1",
    [uid, wid]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    return clone({
      user_id: uid,
      week_id: wid,
      adherence_score: dbResult.rows[0].adherence_score,
      stats: dbResult.rows[0].stats,
    });
  }

  return clone(adherenceStore.get(key(uid, wid)) || null);
}

function getAdherenceSync(userId, weekId) {
  return clone(adherenceStore.get(key(userId, weekId)) || null);
}

async function upsertAdherence(record) {
  const safe = record && typeof record === "object" ? clone(record) : {};
  const uid = toSafeString(safe.user_id, "anonymous");
  const wid = toSafeString(safe.week_id, "");

  adherenceStore.set(key(uid, wid), safe);

  await pg.query(
    [
      "INSERT INTO user_weekly_adherence (user_id, week_id, adherence_score, stats)",
      "VALUES ($1, $2, $3, $4::jsonb)",
      "ON CONFLICT (user_id, week_id)",
      "DO UPDATE SET adherence_score = EXCLUDED.adherence_score, stats = EXCLUDED.stats",
    ].join(" "),
    [uid, wid, safe.adherence_score || 0, JSON.stringify(safe.stats || {})]
  );

  return clone(safe);
}

function upsertAdherenceSync(record) {
  const safe = record && typeof record === "object" ? clone(record) : {};
  adherenceStore.set(key(safe.user_id, safe.week_id), safe);
  return clone(safe);
}

module.exports = {
  getAdherence,
  getAdherenceSync,
  upsertAdherence,
  upsertAdherenceSync,
};
