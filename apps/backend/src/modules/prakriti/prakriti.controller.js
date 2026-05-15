const { buildErrorResponse } = require("../../contracts/errorBuilder");
const { estimatePrakriti } = require("./prakriti.service");
const { toSafeObject } = require("../../utils/safeUtils");

function registerPrakritiRoutes(app) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerPrakritiRoutes requires an app with post(path, ...handlers)");
  }

  const handler = async (req, res) => {
    try {
      const payload = toSafeObject(req && req.body);
      const headers = toSafeObject(req && req.headers);
      const result = await estimatePrakriti(payload, {
        request_id: headers["x-request-id"] || "",
        trace_id: headers["x-trace-id"] || "",
        request_version: headers["x-prakriti-request-version"] || "",
      });
      return res.status(200).json(result);
    } catch (error) {
      const code = error && error.code ? error.code : "INTERNAL_ERROR";
      const message = error instanceof Error ? error.message : "Prakriti estimation failed";
      const details = error && error.details ? error.details : {};
      const statusCode = code === "VALIDATION_ERROR" ? 400 : 500;

      const headers = toSafeObject(req && req.headers);
      return res.status(statusCode).json(buildErrorResponse({
        code,
        message,
        request_id: headers["x-request-id"] || "prakriti_request",
        trace_id: headers["x-trace-id"] || "prakriti_trace",
        details,
      }));
    }
  };

  app.post("/prakriti/estimate", handler);
  app.post("/api/prakriti/estimate", handler);
}

module.exports = {
  registerPrakritiRoutes,
};


