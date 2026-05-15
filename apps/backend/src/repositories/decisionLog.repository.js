const { query, isDbEnabled } = require("../services/db/pg.service");

const DECISION_LOG_UPSERT_SQL = `
    INSERT INTO decision_logs (
      request_id,
      trace_id,
      request_payload,
      response_payload,
      execution_trace,
      safe_trace
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
    ON CONFLICT (request_id) DO UPDATE SET
      trace_id = EXCLUDED.trace_id,
      request_payload = EXCLUDED.request_payload,
      response_payload = EXCLUDED.response_payload,
      execution_trace = EXCLUDED.execution_trace,
      safe_trace = EXCLUDED.safe_trace,
      timestamp = NOW()
  `;

/**
 * Logs a full decision to the database for audibility and replay.
 */
async function logDecision({ request_id, trace_id, request_payload, response_payload, execution_trace, safe_trace }) {
  if (!isDbEnabled()) return null;

  const values = [
    request_id,
    trace_id,
    JSON.stringify(request_payload || {}),
    JSON.stringify(response_payload || {}),
    JSON.stringify(execution_trace || {}),
    JSON.stringify(safe_trace || {}),
  ];

  try {
    return await query(DECISION_LOG_UPSERT_SQL, values);
  } catch (error) {
    console.error(`[DecisionLogRepo] Failed to log decision: ${error.message}`);
    return null;
  }
}

/**
 * Fetches a decision log by its request ID.
 */
async function getDecisionLog(requestId) {
  if (!isDbEnabled()) return null;

  const sql = `SELECT * FROM decision_logs WHERE request_id = $1`;
  try {
    const result = await query(sql, [requestId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`[DecisionLogRepo] Failed to fetch decision log: ${error.message}`);
    return null;
  }
}

/**
 * Fetches recent decision logs for audit.
 */
async function getRecentLogs(limit = 10) {
  if (!isDbEnabled()) return [];

  const sql = `SELECT request_id, trace_id, timestamp FROM decision_logs ORDER BY timestamp DESC LIMIT $1`;
  try {
    const result = await query(sql, [limit]);
    return result.rows || [];
  } catch (error) {
    console.error(`[DecisionLogRepo] Failed to fetch recent logs: ${error.message}`);
    return [];
  }
}

module.exports = {
  logDecision,
  getDecisionLog,
  getRecentLogs,
  DECISION_LOG_UPSERT_SQL,
};
