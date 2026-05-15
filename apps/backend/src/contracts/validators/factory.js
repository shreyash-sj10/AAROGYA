const Ajv = require("ajv");

function formatErrors(errors) {
  return Array.isArray(errors)
    ? errors.map((entry) => ({
      instancePath: entry.instancePath || "",
      schemaPath: entry.schemaPath || "",
      keyword: entry.keyword || "",
      message: entry.message || "validation error",
    }))
    : [];
}

function createValidatorFactory(schemas) {
  const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });

  const decisionRequestSchema = schemas && schemas.DecisionRequest_v1;
  const decisionResponseSchema = schemas && schemas.DecisionResponse_v1;
  const traceSchema = schemas && schemas.Trace_v1;
  const mlInterpretationSchema = schemas && schemas.MLInterpretation_v1;
  const errorResponseSchema = schemas && schemas.ErrorResponse_v1;
  const healthResponseSchema = schemas && schemas.HealthResponse_v1;
  const metricsResponseSchema = schemas && schemas.MetricsResponse_v1;

  if (!decisionRequestSchema || !decisionResponseSchema || !traceSchema) {
    throw new Error("Validator factory requires DecisionRequest_v1, DecisionResponse_v1, and Trace_v1 schemas.");
  }

  ajv.addSchema(traceSchema, "Trace_v1");

  const validateDecisionRequestFn = ajv.compile(decisionRequestSchema);
  const validateTraceFn = ajv.compile(traceSchema);
  const validateDecisionResponseFn = ajv.compile(decisionResponseSchema);
  
  // Optional but recommended schemas
  const validateMLInterpretationFn = mlInterpretationSchema ? ajv.compile(mlInterpretationSchema) : null;
  const validateErrorResponseFn = errorResponseSchema ? ajv.compile(errorResponseSchema) : null;
  const validateHealthResponseFn = healthResponseSchema ? ajv.compile(healthResponseSchema) : null;
  const validateMetricsResponseFn = metricsResponseSchema ? ajv.compile(metricsResponseSchema) : null;

  function validateDecisionRequest(data) {
    const valid = validateDecisionRequestFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateDecisionRequestFn.errors) };
  }

  function validateTrace(data) {
    const valid = validateTraceFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateTraceFn.errors) };
  }

  function validateDecisionResponse(data) {
    const valid = validateDecisionResponseFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateDecisionResponseFn.errors) };
  }

  function validateMLInterpretation(data) {
    if (!validateMLInterpretationFn) return { valid: false, errors: [{ message: "MLInterpretation_v1 validator not compiled" }] };
    const valid = validateMLInterpretationFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateMLInterpretationFn.errors) };
  }

  function validateErrorResponse(data) {
    if (!validateErrorResponseFn) return { valid: false, errors: [{ message: "ErrorResponse_v1 validator not compiled" }] };
    const valid = validateErrorResponseFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateErrorResponseFn.errors) };
  }

  function validateHealthResponse(data) {
    if (!validateHealthResponseFn) return { valid: false, errors: [{ message: "HealthResponse_v1 validator not compiled" }] };
    const valid = validateHealthResponseFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateHealthResponseFn.errors) };
  }

  function validateMetricsResponse(data) {
    if (!validateMetricsResponseFn) return { valid: false, errors: [{ message: "MetricsResponse_v1 validator not compiled" }] };
    const valid = validateMetricsResponseFn(data);
    return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateMetricsResponseFn.errors) };
  }

  return {
    validateDecisionRequest,
    validateDecisionResponse,
    validateTrace,
    validateMLInterpretation,
    validateErrorResponse,
    validateHealthResponse,
    validateMetricsResponse,
  };
}

module.exports = {
  createValidatorFactory,
};
