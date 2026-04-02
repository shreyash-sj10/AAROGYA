function toSafeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function classifyIntent(input) {
  const text = toSafeString(input);

  if (!text) {
    return "GENERAL_QUERY";
  }

  if (text.includes("week") || text.includes("weekly") || text.includes("7 day") || text.includes("seven day")) {
    return "GENERATE_WEEKLY_PLAN";
  }

  if (text.includes("why") || text.includes("explain")) {
    return "EXPLAIN_DECISION";
  }

  if (text.includes("alternative") || text.includes("other option")) {
    return "ASK_ALTERNATIVE";
  }

  if (text.includes("change") || text.includes("replace") || text.includes("modify")) {
    return "REFINE_PLAN";
  }

  if (text.includes("plan") || text.includes("diet") || text.includes("suggest")) {
    return "GENERATE_PLAN";
  }

  return "GENERAL_QUERY";
}

module.exports = {
  classifyIntent,
};
