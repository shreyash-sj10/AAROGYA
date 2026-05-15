const pg = require("../services/db/pg.service");
const defaultRules = require("../rules/engine/rule.samples");

const SOURCE_DB = "DB";
const SOURCE_FALLBACK = "fallback";
const REQUIRE_DB = process.env.REQUIRE_DB === "true";

let cachedRules = null;
let rulesSource = SOURCE_FALLBACK;
let refreshInFlight = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRuleRecord(row) {
  const payload = row && typeof row.payload === "object" ? row.payload : null;
  if (!payload || typeof payload !== "object") return null;
  return payload;
}

function useFallbackRules(reason = "DB failure") {
  if (REQUIRE_DB) {
    throw new Error(`[DATA SOURCE] fallback blocked by REQUIRE_DB (rules): ${reason}`);
  }

  console.warn(`[DATA SOURCE] rules: fallback (DB failure: ${reason})`);
  cachedRules = clone(defaultRules);
  rulesSource = SOURCE_FALLBACK;
  return cachedRules;
}

async function refreshRulesFromDb() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!pg.isDbEnabled()) {
      return useFallbackRules("db_not_enabled");
    }

    try {
      const result = await pg.query(
        [
          "SELECT payload FROM rule_catalog",
          "ORDER BY",
          "CASE priority",
          "WHEN 'P0' THEN 0",
          "WHEN 'P1' THEN 1",
          "WHEN 'P2' THEN 2",
          "WHEN 'P3' THEN 3",
          "ELSE 99 END ASC,",
          "id ASC",
        ].join(" "),
        []
      );

      const rows = Array.isArray(result && result.rows) ? result.rows : [];
      const dbRules = rows.map(normalizeRuleRecord).filter(Boolean).map((item) => clone(item));

      if (dbRules.length === 0) {
        console.error("[DATA ERROR] empty DB result for rules");
        throw new Error("[DATA ERROR] empty DB result for rules");
      }

      cachedRules = dbRules;
      rulesSource = SOURCE_DB;
      console.info("[DATA SOURCE] rules: DB");
      return cachedRules;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message.includes("[DATA ERROR] empty DB result for rules")) {
        throw error;
      }
      return useFallbackRules(message);
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function getRules() {
  if (!Array.isArray(cachedRules) || cachedRules.length === 0) {
    if (!pg.isDbEnabled()) {
      useFallbackRules("lazy_sync_bootstrap");
    } else {
      throw new Error("Rules cache is empty. Repository bootstrap did not complete.");
    }
  }
  return clone(cachedRules);
}

function getRulesSource() {
  return rulesSource;
}

async function initializeRuleRepository() {
  await refreshRulesFromDb();
}

module.exports = {
  getRules,
  getRulesSource,
  refreshRulesFromDb,
  initializeRuleRepository,
};
