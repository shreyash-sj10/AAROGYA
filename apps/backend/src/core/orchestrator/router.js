const ROUTE_MAP = {
  GENERATE_PLAN: { route: "pipeline_full", handler: "handleGeneratePlan" },
  GENERATE_WEEKLY_PLAN: { route: "pipeline_weekly", handler: "handleGenerateWeeklyPlan" },
  REFINE_PLAN: { route: "pipeline_refine", handler: "handleRefinePlan" },
  EXPLAIN_DECISION: { route: "explanation_only", handler: "handleExplain" },
  ASK_ALTERNATIVE: { route: "alternative", handler: "handleAlternative" },
  GENERAL_QUERY: { route: "rag_only", handler: "handleGeneralQuery" },
};

function routeIntent(intent) {
  const key = typeof intent === "string" ? intent : "GENERAL_QUERY";
  return ROUTE_MAP[key] || ROUTE_MAP.GENERAL_QUERY;
}

module.exports = {
  routeIntent,
};
