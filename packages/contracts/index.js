const decisionRequestSchema = require("./schemas/decision-request.v1.schema.json");
const decisionResponseSchema = require("./schemas/decision-response.v1.schema.json");
const traceSchema = require("./schemas/trace.v1.schema.json");
const weeklyDecisionRequestSchema = require("./schemas/weekly-decision-request.v1.schema.json");
const weeklyDecisionResponseSchema = require("./schemas/weekly-decision-response.v1.schema.json");
const healthResponseSchema = require("./schemas/health-response.v1.schema.json");
const metricsResponseSchema = require("./schemas/metrics-response.v1.schema.json");

const schemas = {
  DecisionRequest_v1: decisionRequestSchema,
  DecisionResponse_v1: decisionResponseSchema,
  Trace_v1: traceSchema,
  WeeklyDecisionRequest_v1: weeklyDecisionRequestSchema,
  WeeklyDecisionResponse_v1: weeklyDecisionResponseSchema,
  HealthResponse_v1: healthResponseSchema,
  MetricsResponse_v1: metricsResponseSchema,
};

const validators = require("./validators");

module.exports = {
  schemas,
  decisionRequestSchema,
  decisionResponseSchema,
  traceSchema,
  weeklyDecisionRequestSchema,
  weeklyDecisionResponseSchema,
  healthResponseSchema,
  metricsResponseSchema,
  validators,
};
