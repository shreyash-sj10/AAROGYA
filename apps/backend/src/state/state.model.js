const { toSafeString } = require("../utils/safeUtils");

function toNonNegativeNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function normalizeDosha(values) {
  const safeValues = values && typeof values === "object" ? values : {};
  const vata = toNonNegativeNumber(safeValues.vata);
  const pitta = toNonNegativeNumber(safeValues.pitta);
  const kapha = toNonNegativeNumber(safeValues.kapha);
  const total = vata + pitta + kapha;

  if (total <= 0) {
    return {
      vata: 0.333333,
      pitta: 0.333333,
      kapha: 0.333334,
    };
  }

  const normalizedVata = Number((vata / total).toFixed(6));
  const normalizedPitta = Number((pitta / total).toFixed(6));
  const normalizedKapha = Number((1 - normalizedVata - normalizedPitta).toFixed(6));

  return {
    vata: normalizedVata,
    pitta: normalizedPitta,
    kapha: normalizedKapha,
  };
}

function normalizeDate(value) {
  const safeDate = toSafeString(value, "");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  return datePattern.test(safeDate) ? safeDate : "";
}

function createEmptyState(user_id, date) {
  return {
    user_id: toSafeString(user_id, ""),
    date: normalizeDate(date),
    totals: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
    dosha_balance: normalizeDosha({ vata: 1, pitta: 1, kapha: 1 }),
    meals: [],
  };
}

module.exports = {
  createEmptyState,
};
