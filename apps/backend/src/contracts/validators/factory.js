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

  if (!decisionRequestSchema || !decisionResponseSchema || !traceSchema) {
    throw new Error("Validator factory requires DecisionRequest_v1, DecisionResponse_v1, and Trace_v1 schemas.");
  }

  ajv.addSchema(traceSchema, "Trace_v1");

  const validateDecisionRequestFn = ajv.compile(decisionRequestSchema);
  const validateTraceFn = ajv.compile(traceSchema);
  const validateDecisionResponseFn = ajv.compile(decisionResponseSchema);

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

  return {
    validateDecisionRequest,
    validateDecisionResponse,
    validateTrace,
  };
}

module.exports = {
  createValidatorFactory,
};
