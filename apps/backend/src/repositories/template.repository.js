const pg = require("../services/db/pg.service");
const fallbackTemplates = require("../templates/mealTemplates.json");

const SOURCE_DB = "DB";
const SOURCE_FALLBACK = "fallback";
const REQUIRE_DB = process.env.REQUIRE_DB === "true";

let cachedTemplates = null;
let templatesSource = SOURCE_FALLBACK;
let refreshInFlight = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTemplateRecord(row) {
  const payload = row && typeof row.payload === "object" ? row.payload : null;
  if (!payload) return null;
  return payload;
}

function useFallbackTemplates(reason = "DB failure") {
  if (REQUIRE_DB) {
    throw new Error(`[DATA SOURCE] fallback blocked by REQUIRE_DB (templates): ${reason}`);
  }

  console.warn(`[DATA SOURCE] templates: fallback (DB failure: ${reason})`);
  cachedTemplates = clone(fallbackTemplates);
  templatesSource = SOURCE_FALLBACK;
  return cachedTemplates;
}

async function refreshTemplatesFromDb() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!pg.isDbEnabled()) {
      return useFallbackTemplates("db_not_enabled");
    }

    try {
      const result = await pg.query("SELECT payload FROM meal_templates ORDER BY meal_type ASC, priority ASC, id ASC", []);
      const rows = Array.isArray(result && result.rows) ? result.rows : [];
      const dbTemplates = rows.map(normalizeTemplateRecord).filter(Boolean).map((item) => clone(item));

      if (dbTemplates.length === 0) {
        console.error("[DATA ERROR] empty DB result for templates");
        throw new Error("[DATA ERROR] empty DB result for templates");
      }

      cachedTemplates = dbTemplates;
      templatesSource = SOURCE_DB;
      console.info("[DATA SOURCE] templates: DB");
      return cachedTemplates;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message.includes("[DATA ERROR] empty DB result for templates")) {
        throw error;
      }
      return useFallbackTemplates(message);
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function getTemplates() {
  if (!Array.isArray(cachedTemplates) || cachedTemplates.length === 0) {
    if (!pg.isDbEnabled()) {
      useFallbackTemplates("lazy_sync_bootstrap");
    } else {
      throw new Error("Templates cache is empty. Repository bootstrap did not complete.");
    }
  }
  return clone(cachedTemplates);
}

function getTemplatesSource() {
  return templatesSource;
}

async function initializeTemplateRepository() {
  await refreshTemplatesFromDb();
}

module.exports = {
  getTemplates,
  getTemplatesSource,
  refreshTemplatesFromDb,
  initializeTemplateRepository,
};
