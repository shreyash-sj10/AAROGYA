const { recordApiRequest, recordApiError } = require("../../observability/metrics");

function apiTelemetry(req, res, next) {
  recordApiRequest();

  res.on("finish", () => {
    if (res.statusCode >= 400) {
      recordApiError();
    }
  });

  next();
}

module.exports = {
  apiTelemetry,
};
