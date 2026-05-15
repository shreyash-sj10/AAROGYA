const Ajv = require("ajv");
const traceSchema = require("../schemas/trace.v1.schema.json");
const decisionResponseSchema = require("../schemas/decision-response.v1.schema.json");
const dailyResponseSchema = require("../schemas/daily-response.v1.schema.json");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });
ajv.addSchema(traceSchema, "Trace_v1");
ajv.addSchema(decisionResponseSchema, "DecisionResponse_v1");
const validateFn = ajv.compile(dailyResponseSchema);

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

function validateDailyResponse(data) {
  const valid = validateFn(data);
  return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateFn.errors) };
}

module.exports = {
  validateDailyResponse,
};
