function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildErrorResponse({ code, message, details } = {}) {
  return {
    version: "v1",
    error: {
      code: toSafeString(code, "INTERNAL_ERROR"),
      message: toSafeString(message, "Internal server error"),
      details: toSafeObject(details),
    },
  };
}

module.exports = {
  buildErrorResponse,
};
