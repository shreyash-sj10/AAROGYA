const pg = require("../services/db/pg.service");

const weeklyPlanStore = new Map();

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function key(userId, weekId) {
  return `${toSafeString(userId, "anonymous")}::${toSafeString(weekId, "")}`;
}

async function saveWeeklyPlan(record) {
  const safe = record && typeof record === "object" ? clone(record) : {};
  const userId = toSafeString(safe.user_id, "anonymous");
  const weekId = toSafeString(safe.week_id, "");

  await pg.query(
    [
      "INSERT INTO weekly_plans (user_id, week_id, plan)",
      "VALUES ($1, $2, $3::jsonb)",
      "ON CONFLICT (user_id, week_id) DO UPDATE SET plan = EXCLUDED.plan",
    ].join(" "),
    [userId, weekId, JSON.stringify(safe.plan || safe)]
  );

  weeklyPlanStore.set(key(userId, weekId), clone(safe));
  return clone(safe);
}

async function getWeeklyPlan(userId, weekId) {
  const uid = toSafeString(userId, "anonymous");
  const wid = toSafeString(weekId, "");

  const dbResult = await pg.query(
    "SELECT plan FROM weekly_plans WHERE user_id = $1 AND week_id = $2 LIMIT 1",
    [uid, wid]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    const plan = clone(dbResult.rows[0].plan || null);
    weeklyPlanStore.set(key(uid, wid), { user_id: uid, week_id: wid, plan: clone(plan) });
    return plan;
  }

  const inMemory = weeklyPlanStore.get(key(uid, wid));
  return inMemory ? clone(inMemory.plan || inMemory) : null;
}

module.exports = {
  saveWeeklyPlan,
  getWeeklyPlan,
};
