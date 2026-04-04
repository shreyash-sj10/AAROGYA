const Ajv = require("ajv");
const schema = require("../schemas/error-response.v1.schema.json");
const traceSchema = require("../schemas/trace.v1.schema.json");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });
ajv.addSchema(traceSchema, "Trace_v1");
const validateFn = ajv.compile(schema);

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

function validateErrorResponse(data) {
  const valid = validateFn(data);
  return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateFn.errors) };
}

module.exports = {
  validateErrorResponse,
};
