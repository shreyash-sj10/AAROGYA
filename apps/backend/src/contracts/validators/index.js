const decisionRequestSchema = require("../schemas/decision-request.v1.schema.json");
const decisionResponseSchema = require("../schemas/decision-response.v1.schema.json");
const traceSchema = require("../schemas/trace.v1.schema.json");
const weeklyDecisionRequestSchema = require("../schemas/weekly-decision-request.v1.schema.json");
const weeklyDecisionResponseSchema = require("../schemas/weekly-decision-response.v1.schema.json");
const healthResponseSchema = require("../schemas/health-response.v1.schema.json");
const metricsResponseSchema = require("../schemas/metrics-response.v1.schema.json");
const errorResponseSchema = require("../schemas/error-response.v1.schema.json");
const assistantResponseSchema = require("../schemas/assistant-response.v1.schema.json");
const dailyResponseSchema = require("../schemas/daily-response.v1.schema.json");
const mlInterpretationSchema = require("../schemas/ml-interpretation.v1.schema.json");
const planWeeklyRequestSchema = require("../schemas/plan-weekly-request.v1.schema.json");
const planWeeklyResponseSchema = require("../schemas/plan-weekly-response.v1.schema.json");
const scaledRecipeSchema = require("../schemas/scaled-recipe.v1.schema.json");
const { createValidatorFactory } = require("./factory");

const compiled = createValidatorFactory({
  DecisionRequest_v1: decisionRequestSchema,
  DecisionResponse_v1: decisionResponseSchema,
  MLInterpretation_v1: mlInterpretationSchema,
  ErrorResponse_v1: errorResponseSchema,
  HealthResponse_v1: healthResponseSchema,
  MetricsResponse_v1: metricsResponseSchema,
  Trace_v1: traceSchema,
});

module.exports = {
  validateDecisionRequest: compiled.validateDecisionRequest,
  validateDecisionResponse: compiled.validateDecisionResponse,
  validateMLInterpretation: compiled.validateMLInterpretation,
  validateErrorResponse: compiled.validateErrorResponse,
  validateHealthResponse: compiled.validateHealthResponse,
  validateMetricsResponse: compiled.validateMetricsResponse,
  validateTrace: compiled.validateTrace,
  weeklyDecisionRequestSchema,
  weeklyDecisionResponseSchema,
  healthResponseSchema,
  metricsResponseSchema,
  errorResponseSchema,
  assistantResponseSchema,
  dailyResponseSchema,
  planWeeklyRequestSchema,
  planWeeklyResponseSchema,
  scaledRecipeSchema,
};
