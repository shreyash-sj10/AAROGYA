const express = require("express");
const cors = require("cors");
const { registerApiRoutes } = require("./api/routes");
const { apiTelemetry } = require("./api/middleware/apiTelemetry");
const { buildErrorResponse } = require("./contracts/errorBuilder");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(apiTelemetry);

registerApiRoutes(app);

app.use((error, req, res, _next) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  const safeBody = req && req.body && typeof req.body === "object" ? req.body : {};
  const safeMeta = safeBody.meta && typeof safeBody.meta === "object" ? safeBody.meta : {};

  return res.status(500).json(buildErrorResponse({
    code: "INTERNAL_ERROR",
    message,
    request_id: safeBody.request_id || safeMeta.request_id || "unknown_request",
    trace_id: safeBody.trace_id || safeMeta.trace_id || "unknown_trace",
    details: {
      source: "server.middleware",
    },
  }));
});

const PORT = Number(process.env.PORT || 5000);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AYUDIET backend server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
};
