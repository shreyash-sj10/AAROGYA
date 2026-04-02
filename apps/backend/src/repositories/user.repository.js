const pg = require("../services/db/pg.service");

const userStore = new Map();

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function getUserById(userId) {
  const id = toSafeString(userId, "anonymous");

  const dbResult = await pg.query(
    "SELECT id, data FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  if (dbResult && dbResult.rows && dbResult.rows[0]) {
    const row = dbResult.rows[0];
    return row.data && typeof row.data === "object" ? clone(row.data) : null;
  }

  return clone(userStore.get(id) || null);
}

async function upsertUser(user) {
  const safeUser = user && typeof user === "object" ? clone(user) : {};
  const id = toSafeString(safeUser.id || safeUser.user_id, "anonymous");

  userStore.set(id, safeUser);

  await pg.query(
    [
      "INSERT INTO users (id, data)",
      "VALUES ($1, $2::jsonb)",
      "ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
    ].join(" "),
    [id, JSON.stringify(safeUser)]
  );

  return clone(safeUser);
}

module.exports = {
  getUserById,
  upsertUser,
};
