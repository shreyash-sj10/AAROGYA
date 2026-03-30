const Ajv = require("ajv");
const schema = require("./rule.schema");

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

const validate = ajv.compile(schema);

function mapAjvErrors(errors) {
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message || "Validation error",
    keyword: error.keyword,
    params: error.params || {},
  }));
}

function validateRule(rule) {
  const isValid = validate(rule);

  return {
    isValid: Boolean(isValid),
    errors: isValid ? [] : mapAjvErrors(validate.errors),
  };
}

function validateRules(rules) {
  if (!Array.isArray(rules)) {
    return {
      validRules: [],
      invalidRules: [
        {
          rule: rules,
          errors: [
            {
              path: "/",
              message: "Input must be an array of rules",
              keyword: "type",
              params: { expected: "array" },
            },
          ],
        },
      ],
    };
  }

  return rules.reduce(
    (result, rule) => {
      const validation = validateRule(rule);

      if (validation.isValid) {
        result.validRules.push(rule);
      } else {
        result.invalidRules.push({
          rule,
          errors: validation.errors,
        });
      }

      return result;
    },
    {
      validRules: [],
      invalidRules: [],
    }
  );
}

module.exports = {
  validateRule,
  validateRules,
};
