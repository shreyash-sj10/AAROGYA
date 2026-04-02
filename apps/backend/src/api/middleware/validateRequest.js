const { validateDecisionRequest } = require("../../contracts/validators/validateDecisionRequest");
const { buildErrorResponse } = require("../../contracts/errorBuilder");

function validateRequest(req, res, next) {
  const validation = validateDecisionRequest(req && req.body);
  if (!validation.valid) {
    return res.status(400).json(buildErrorResponse({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      details: {
        errors: Array.isArray(validation.errors) ? validation.errors : [],
      },
    }));
  }

  return next();
}

module.exports = {
  validateRequest,
};
