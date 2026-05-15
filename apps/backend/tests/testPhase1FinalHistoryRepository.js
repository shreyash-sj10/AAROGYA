const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mockModuleAbsolute(absolutePath, exportsValue) {
  const original = require.cache[absolutePath];
  require.cache[absolutePath] = {
    id: absolutePath,
    filename: absolutePath,
    loaded: true,
    exports: exportsValue,
  };

  return () => {
    if (original) {
      require.cache[absolutePath] = original;
    } else {
      delete require.cache[absolutePath];
    }
  };
}

(async () => {
  const calls = [];
  const mockPg = {
    isDbEnabled: () => true,
    query: async (sql, values = []) => {
      calls.push({ sql: String(sql), values });
      const normalized = String(sql).trim().toUpperCase();

      if (normalized.startsWith("SELECT MEAL_ID")) {
        return {
          rows: [
            { meal_id: "dal-001", category: "dal", timestamp: "2026-01-01T00:00:00.000Z" },
          ],
        };
      }

      return { rows: [] };
    },
    withTransaction: async () => {
      throw new Error("withTransaction not used in this test");
    },
    shutdownPool: async () => {},
  };

  const pgPath = path.resolve(__dirname, "../src/services/db/pg.service.js");
  const restore = mockModuleAbsolute(pgPath, mockPg);

  const repoPath = path.resolve(__dirname, "../src/repositories/history.repository.js");
  delete require.cache[repoPath];
  const { storeMealSelection, getRecentMeals } = require(repoPath);

  const stored = await storeMealSelection("history_user", [{ recipe_id: "dal-001", category: "dal" }], "lunch");
  const recent = await getRecentMeals("history_user", 5);

  restore();

  assert(stored === true, "storeMealSelection should succeed when DB is enabled");
  assert(Array.isArray(recent) && recent.length === 1, "getRecentMeals should return DB rows");

  const createTableCalls = calls.filter((c) => c.sql.includes("CREATE TABLE IF NOT EXISTS user_meal_history"));
  const insertCalls = calls.filter((c) => c.sql.includes("INSERT INTO user_meal_history"));
  const selectCalls = calls.filter((c) => c.sql.includes("SELECT meal_id, category, timestamp FROM user_meal_history"));

  assert(createTableCalls.length >= 1, "history table bootstrap CREATE TABLE should run");
  assert(insertCalls.length >= 1, "storeMealSelection should execute INSERT");
  assert(selectCalls.length >= 1, "getRecentMeals should execute SELECT");

  console.log("PASS: history repository ensures table and supports read/write path");
})();
