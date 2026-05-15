/**
 * Phase 4 — single transaction for post-plan persistence (history + audit log).
 * Keeps meal history rows and decision_logs consistent: both commit or neither.
 */
const pg = require("./pg.service");
const { toSafeString } = require("../../utils/safeUtils");
const { MEAL_HISTORY_BOOTSTRAP_SQL } = require("../../repositories/history.repository");
const { DECISION_LOG_UPSERT_SQL } = require("../../repositories/decisionLog.repository");

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {unknown[]} params.mealPlan
 * @param {string} params.category
 * @param {{ request_id: string, trace_id: string, request_payload: unknown, response_payload: unknown, execution_trace: unknown, safe_trace: unknown }} params.decision
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
async function persistPostPlanArtifacts(params) {
  if (!pg.isDbEnabled()) {
    return { ok: false, reason: "db_disabled" };
  }

  const userId = toSafeString(params.userId, "anonymous");
  const mealPlan = Array.isArray(params.mealPlan) ? params.mealPlan : [];
  const category = toSafeString(params.category, "");
  const decision = params.decision && typeof params.decision === "object" ? params.decision : {};

  if (mealPlan.length === 0) {
    return { ok: false, reason: "empty_meal_plan" };
  }

  const requestId = toSafeString(decision.request_id, "");
  const traceId = toSafeString(decision.trace_id, "");
  if (!requestId || !traceId) {
    return { ok: false, reason: "missing_request_or_trace_id" };
  }

  try {
    await pg.withTransaction(async (client) => {
      await client.query(MEAL_HISTORY_BOOTSTRAP_SQL);

      for (const item of mealPlan) {
        const mealId = toSafeString(item && (item.recipe_id || item.id), "unknown");
        const mealCategory = toSafeString((item && item.category) || category, "");
        await client.query(
          "INSERT INTO user_meal_history (user_id, meal_id, category) VALUES ($1, $2, $3)",
          [userId, mealId, mealCategory]
        );
      }

      await client.query(DECISION_LOG_UPSERT_SQL, [
        requestId,
        traceId,
        JSON.stringify(decision.request_payload || {}),
        JSON.stringify(decision.response_payload || {}),
        JSON.stringify(decision.execution_trace || {}),
        JSON.stringify(decision.safe_trace || {}),
      ]);
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    return { ok: false, reason: message.slice(0, 500) };
  }
}

module.exports = {
  persistPostPlanArtifacts,
};
