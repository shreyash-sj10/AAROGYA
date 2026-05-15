const pino = require("pino");

const level = process.env.LOG_LEVEL
  || (process.env.NODE_ENV === "production" ? "info" : "debug");

/** Root logger — child loggers add request-scoped fields */
const rootLogger = pino({
  level,
  base: { service: "aarogya-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function loggerWithRequest() {
  const { getRequestContext } = require("./requestContext");
  const { requestId } = getRequestContext();
  if (requestId) {
    return rootLogger.child({ requestId });
  }
  return rootLogger;
}

module.exports = {
  rootLogger,
  loggerWithRequest,
};
