const pg = require("../services/db/pg.service");
const { toSafeString, toSafeNumber } = require("../utils/safeUtils");

let historyTableReadyPromise = null;

function buildDbNotConnectedError(cause) {
  const error = new Error("DB_NOT_CONNECTED");
  if (cause) {
    error.cause = cause;
  }
  return error;
}

const MEAL_HISTORY_BOOTSTRAP_SQL = `
    CREATE TABLE IF NOT EXISTS user_meal_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      meal_id TEXT NOT NULL,
      category TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_meal_history_user_time
      ON user_meal_history(user_id, timestamp DESC);
  `;

async function ensureHistoryTable() {
  if (!pg.isDbEnabled()) {
    throw buildDbNotConnectedError();
  }

  if (historyTableReadyPromise) {
    return historyTableReadyPromise;
  }

  historyTableReadyPromise = pg.query(MEAL_HISTORY_BOOTSTRAP_SQL).catch((error) => {
    historyTableReadyPromise = null;
    throw buildDbNotConnectedError(error);
  });

  return historyTableReadyPromise;
}

async function getRecentMeals(userId, limit = 30) {
  const uid = toSafeString(userId, "anonymous");
  const MAX_LIMIT = 30;
  const safeLimit = Math.min(Math.max(1, Math.trunc(toSafeNumber(limit, MAX_LIMIT))), MAX_LIMIT);

  if (!pg.isDbEnabled()) {
    console.warn("[HistoryRepo] DB unavailable, returning empty history fallback");
    return [];
  }

  try {
    await ensureHistoryTable();
    const dbResult = await pg.query(
      "SELECT meal_id, category, timestamp FROM user_meal_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2",
      [uid, safeLimit]
    );

    return (dbResult.rows || []).map((row) => ({
      meal_id: row.meal_id,
      category: row.category,
      timestamp: row.timestamp,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    console.warn(`[HistoryRepo] DB read failed, returning empty history fallback: ${message}`);
    return [];
  }
}
async function storeMealSelection(userId, mealPlan, category) {
  const uid = toSafeString(userId, "anonymous");
  const plan = Array.isArray(mealPlan) ? mealPlan : [];
  if (!pg.isDbEnabled()) {
    throw buildDbNotConnectedError();
  }

  if (plan.length === 0) {
    return false;
  }

  try {
    await ensureHistoryTable();

    for (const item of plan) {
      const mealId = toSafeString(item.recipe_id || item.id, "unknown");
      const mealCategory = toSafeString(category || item.category, "");

      await pg.query(
        "INSERT INTO user_meal_history (user_id, meal_id, category) VALUES ($1, $2, $3)",
        [uid, mealId, mealCategory]
      );
    }
    return true;
  } catch (error) {
    throw buildDbNotConnectedError(error);
  }
}

module.exports = {
  getRecentMeals,
  storeMealSelection,
  ensureHistoryTable,
  MEAL_HISTORY_BOOTSTRAP_SQL,
};


