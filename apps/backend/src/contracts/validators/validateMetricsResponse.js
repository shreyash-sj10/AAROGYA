const Ajv = require("ajv");
const schema = require("../schemas/metrics-response.v1.schema.json");

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });
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

function validateMetricsResponse(data) {
  const valid = validateFn(data);
  return valid ? { valid: true, errors: [] } : { valid: false, errors: formatErrors(validateFn.errors) };
}

module.exports = {
  validateMetricsResponse,
};
