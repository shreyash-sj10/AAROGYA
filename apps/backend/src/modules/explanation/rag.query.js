function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildRAGQuery(decisionData) {
  const safeData = toSafeObject(decisionData);
  const riskFlags = unique(toSafeArray(safeData.risk_flags).map(toSafeString));
  const recipes = unique(toSafeArray(safeData.selected_recipes).map(toSafeString));
  const trace = unique(toSafeArray(safeData.reasoning_trace).map(toSafeString));

  const riskPart = riskFlags.length > 0 ? riskFlags.join(", ") : "general balance";
  const recipePart = recipes.length > 0 ? recipes.join(", ") : "selected foods";
  const tracePart = trace.length > 0 ? trace.join("; ") : "deterministic scoring and constraints";

  return `Explain why ${recipePart} were selected for ${riskPart} based on ${tracePart}.`;
}

module.exports = {
  buildRAGQuery,
};
