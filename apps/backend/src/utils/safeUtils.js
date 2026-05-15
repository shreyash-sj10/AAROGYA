/**
 * AAROGYA Safe Utilities
 * Centralized helpers for reliable input normalization and safety checks.
 * Prevents duplicate identifier errors and inconsistent fallback behavior.
 */

/**
 * Returns a trimmed string or a fallback.
 */
function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Returns a valid finite number or a fallback.
 */
function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Returns a clean object (excludes null and arrays) or an empty object.
 */
function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Returns an array or an empty array.
 */
function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  toSafeString,
  toSafeNumber,
  toSafeObject,
  toSafeArray,
};
