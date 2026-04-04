const { buildErrorResponse } = require("../../contracts/errorBuilder");

function createApiKeyGuard({ keyEnv = "API_KEY" } = {}) {
  return function apiKeyGuard(req, res, next) {
    const expected = process.env[keyEnv];

    if (!expected) {
      next();
      return;
    }

    const provided = req.headers["x-api-key"] || req.headers["authorization"];

    if (provided !== expected) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      const headers = req && req.headers && typeof req.headers === "object" ? req.headers : {};
      res.end(JSON.stringify(buildErrorResponse({
        code: "UNAUTHORIZED",
        message: "Unauthorized",
        request_id: headers["x-request-id"] || "unknown_request",
        trace_id: headers["x-trace-id"] || "unknown_trace",
        details: {
          source: "apiKeyGuard",
        },
      })));
      return;
    }

    next();
  };
}

module.exports = {
  createApiKeyGuard,
};

