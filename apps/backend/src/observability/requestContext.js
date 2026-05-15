const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("node:crypto");

const als = new AsyncLocalStorage();

/**
 * @returns {{ requestId?: string, method?: string, path?: string }}
 */
function getRequestContext() {
  return als.getStore() || {};
}

function requestContextMiddleware(req, res, next) {
  const incoming = typeof req.get === "function" ? req.get("x-request-id") : "";
  const requestId = typeof incoming === "string" && incoming.trim()
    ? incoming.trim().slice(0, 128)
    : crypto.randomUUID();

  res.setHeader("X-Request-Id", requestId);

  const store = {
    requestId,
    method: req.method,
    path: typeof req.path === "string" ? req.path : req.url,
  };

  als.run(store, () => next());
}

module.exports = {
  getRequestContext,
  requestContextMiddleware,
};
