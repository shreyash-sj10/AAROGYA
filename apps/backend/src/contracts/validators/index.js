const decisionRequestSchema = require("../schemas/decision-request.v1.schema.json");
const decisionResponseSchema = require("../schemas/decision-response.v1.schema.json");
const traceSchema = require("../schemas/trace.v1.schema.json");
const weeklyDecisionRequestSchema = require("../schemas/weekly-decision-request.v1.schema.json");
const weeklyDecisionResponseSchema = require("../schemas/weekly-decision-response.v1.schema.json");
const healthResponseSchema = require("../schemas/health-response.v1.schema.json");
const metricsResponseSchema = require("../schemas/metrics-response.v1.schema.json");
const { createValidatorFactory } = require("./factory");

const compiled = createValidatorFactory({
  DecisionRequest_v1: decisionRequestSchema,
  DecisionResponse_v1: decisionResponseSchema,
  Trace_v1: traceSchema,
});

module.exports = {
  validateDecisionRequest: compiled.validateDecisionRequest,
  validateDecisionResponse: compiled.validateDecisionResponse,
  validateTrace: compiled.validateTrace,
  weeklyDecisionRequestSchema,
  weeklyDecisionResponseSchema,
  healthResponseSchema,
  metricsResponseSchema,
};
