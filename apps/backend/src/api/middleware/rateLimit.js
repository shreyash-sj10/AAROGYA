const { buildErrorResponse } = require("../../contracts/errorBuilder");

const rateState = new Map();

function createRateLimiter({ windowMs = 60000, max = 120 } = {}) {
  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const current = rateState.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    rateState.set(ip, current);

    if (current.count > max) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      const headers = req && req.headers && typeof req.headers === "object" ? req.headers : {};
      res.end(JSON.stringify(buildErrorResponse({
        code: "RATE_LIMITED",
        message: "Rate limit exceeded",
        request_id: headers["x-request-id"] || "unknown_request",
        trace_id: headers["x-trace-id"] || "unknown_trace",
        details: {
          source: "rateLimiter",
          window_ms: windowMs,
          max,
        },
      })));
      return;
    }

    next();
  };
}

module.exports = {
  createRateLimiter,
};

