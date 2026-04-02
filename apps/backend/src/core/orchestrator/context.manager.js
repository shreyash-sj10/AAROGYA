const contextRepository = require("../../repositories/context.repository");

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getContext(user_id) {
  const userId = toSafeString(user_id, "anonymous");
  const existing = contextRepository.getContextSync(userId);

  if (existing && typeof existing === "object") {
    return clone(existing);
  }

  return {
    last_plan: null,
    user_state: {},
    last_intent: null,
  };
}

async function updateContext(user_id, data) {
  const userId = toSafeString(user_id, "anonymous");
  const existing = getContext(userId);
  const safeData = toSafeObject(data);

  const next = {
    last_plan: safeData.last_plan !== undefined ? safeData.last_plan : existing.last_plan,
    user_state: safeData.user_state !== undefined ? toSafeObject(safeData.user_state) : existing.user_state,
    last_intent: safeData.last_intent !== undefined ? safeData.last_intent : existing.last_intent,
  };

  const saved = await contextRepository.saveContext(userId, next);
  return clone(saved);
}

module.exports = {
  getContext,
  updateContext,
};
