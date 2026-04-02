const adherenceRepository = require("../../repositories/adherence.repository");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

const logger = {
  error(message, meta = {}) {
    const safeMeta = meta && typeof meta === "object" ? meta : {};
    const errMessage = safeMeta.err instanceof Error ? safeMeta.err.message : "";

    logError({
      error_type: "SYSTEM_ERROR",
      message: errMessage ? `${message}: ${errMessage}` : message,
    });
  },
};

const metrics = {
  increment() {
    recordError("SYSTEM_ERROR");
  },
};

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function parseDateInput(dateInput) {
  const safeDate = toSafeString(dateInput, "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) {
    return new Date();
  }

  const parsed = new Date(`${safeDate}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveWeekId(mealEvent) {
  const safeEvent = toSafeObject(mealEvent);
  const explicitWeekId = toSafeString(safeEvent.week_id || safeEvent.weekId, "");

  if (explicitWeekId) {
    return explicitWeekId;
  }

  const date = parseDateInput(safeEvent.date);
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek);

  return formatDateUTC(date);
}

function createEmptyStats() {
  return {
    meals_followed: 0,
    meals_skipped: 0,
    meals_modified: 0,
    adherence_score: 0,
  };
}

function normalizeEventType(mealEvent) {
  const safeEvent = toSafeObject(mealEvent);
  const rawType = toSafeString(safeEvent.event_type || safeEvent.type, "").toUpperCase();

  if (rawType === "FOLLOWED" || rawType === "SKIPPED" || rawType === "REPLACED") {
    return rawType;
  }

  return "FOLLOWED";
}

function calculateAdherenceScore(stats) {
  const safeStats = toSafeObject(stats);
  const followed = Math.max(0, toSafeNumber(safeStats.meals_followed, 0));
  const skipped = Math.max(0, toSafeNumber(safeStats.meals_skipped, 0));
  const modified = Math.max(0, toSafeNumber(safeStats.meals_modified, 0));
  const totalMeals = followed + skipped + modified;

  if (totalMeals <= 0) {
    return 0;
  }

  return round(followed / totalMeals);
}

function getWeeklyAdherence(user_id, week_id) {
  const userId = toSafeString(user_id, "anonymous");
  const weekId = toSafeString(week_id, resolveWeekId({}));
  const existing = adherenceRepository.getAdherenceSync(userId, weekId);

  if (!existing) {
    return {
      user_id: userId,
      week_id: weekId,
      adherence_score: 0,
      stats: createEmptyStats(),
    };
  }

  return {
    user_id: userId,
    week_id: weekId,
    adherence_score: toSafeNumber(existing.adherence_score, 0),
    stats: clonePlain(existing.stats || createEmptyStats()),
  };
}

function trackAdherence(user_id, meal_event) {
  const userId = toSafeString(user_id, "anonymous");
  const weekId = resolveWeekId(meal_event);
  const eventType = normalizeEventType(meal_event);
  const currentRecord = getWeeklyAdherence(userId, weekId);
  const current = clonePlain(currentRecord.stats || createEmptyStats());

  if (eventType === "FOLLOWED") {
    current.meals_followed += 1;
  } else if (eventType === "SKIPPED") {
    current.meals_skipped += 1;
  } else if (eventType === "REPLACED") {
    current.meals_modified += 1;
  }

  current.adherence_score = calculateAdherenceScore(current);

  const saved = {
    user_id: userId,
    week_id: weekId,
    adherence_score: current.adherence_score,
    stats: clonePlain(current),
  };

  adherenceRepository.upsertAdherenceSync(saved);
  adherenceRepository.upsertAdherence(saved).catch((err) => {
    logger.error("Adherence persistence failed", { err });
    metrics.increment("adherence_write_error");
  });

  return saved;
}

function buildWeeklyAdherenceUpsert(record) {
  const safeRecord = toSafeObject(record);

  return {
    text: [
      "INSERT INTO user_weekly_adherence (user_id, week_id, adherence_score, stats)",
      "VALUES ($1, $2, $3, $4::jsonb)",
      "ON CONFLICT (user_id, week_id)",
      "DO UPDATE SET adherence_score = EXCLUDED.adherence_score, stats = EXCLUDED.stats",
    ].join(" "),
    values: [
      toSafeString(safeRecord.user_id, "anonymous"),
      toSafeString(safeRecord.week_id, resolveWeekId({})),
      round(toSafeNumber(safeRecord.adherence_score, 0)),
      JSON.stringify(toSafeObject(safeRecord.stats)),
    ],
  };
}

function summarizeAdherence(record) {
  const safeRecord = toSafeObject(record);
  const stats = toSafeObject(safeRecord.stats);
  const followed = Math.max(0, toSafeNumber(stats.meals_followed, 0));
  const skipped = Math.max(0, toSafeNumber(stats.meals_skipped, 0));
  const modified = Math.max(0, toSafeNumber(stats.meals_modified, 0));
  const score = round(toSafeNumber(safeRecord.adherence_score, 0));

  return `Weekly adherence is ${score} with ${followed} followed, ${skipped} skipped, and ${modified} replaced meals.`;
}

async function summarizeAdherenceWithAI(record, options = {}) {
  const safeOptions = toSafeObject(options);
  const generateText = safeOptions.generateText;
  const deterministicSummary = summarizeAdherence(record);

  if (typeof generateText !== "function") {
    return deterministicSummary;
  }

  const prompt = "Summarize user adherence behavior in 1 sentence using structured data only.";

  const aiSummary = await generateText({
    prompt,
    data: toSafeObject(record),
  });

  return toSafeString(aiSummary, deterministicSummary);
}

module.exports = {
  trackAdherence,
  getWeeklyAdherence,
  buildWeeklyAdherenceUpsert,
  summarizeAdherence,
  summarizeAdherenceWithAI,
};
