const { createEmptyState } = require("./state.model");
const stateRepository = require("../../repositories/state.repository");
const { toSafeString } = require("../utils/safeUtils");

function getStateKey(userId, date) {
  return `${toSafeString(userId)}::${toSafeString(date)}`;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function getDayStateSync(user_id, date) {
  const existing = stateRepository.getStateSync(user_id, date);

  if (existing && typeof existing === "object") {
    return clonePlain(existing);
  }

  return createEmptyState(user_id, date);
}

async function getDayState(user_id, date) {
  const dbState = await stateRepository.getState(user_id, date);

  if (dbState && typeof dbState === "object") {
    return clonePlain(dbState);
  }

  return getDayStateSync(user_id, date);
}

function saveDayStateSync(state) {
  const safeState = state && typeof state === "object" ? clonePlain(state) : createEmptyState("", "");
  stateRepository.saveStateSync(safeState);

  return clonePlain(safeState);
}

async function saveDayState(state) {
  const saved = await stateRepository.saveState(state);
  if (saved && typeof saved === "object") {
    return clonePlain(saved);
  }

  return saveDayStateSync(state);
}

module.exports = {
  getDayState,
  getDayStateSync,
  saveDayStateSync,
  saveDayState,
};
