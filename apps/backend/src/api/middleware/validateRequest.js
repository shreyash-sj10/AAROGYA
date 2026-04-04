const { validateDecisionRequest } = require("../../contracts/validators/validateDecisionRequest");
const { buildErrorResponse } = require("../../contracts/errorBuilder");

function validateRequest(req, res, next) {
  const validation = validateDecisionRequest(req && req.body);
  if (!validation.valid) {
    const safeBody = req && req.body && typeof req.body === "object" ? req.body : {};
    const safeMeta = safeBody.meta && typeof safeBody.meta === "object" ? safeBody.meta : {};
    return res.status(400).json(buildErrorResponse({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      request_id: safeBody.request_id || safeMeta.request_id || "unknown_request",
      trace_id: safeBody.trace_id || safeMeta.trace_id || "unknown_trace",
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

