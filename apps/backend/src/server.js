const express = require("express");
const cors = require("cors");
const { registerApiRoutes } = require("./api/routes");
const { apiTelemetry } = require("./api/middleware/apiTelemetry");
const { buildErrorResponse } = require("./contracts/errorBuilder");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(apiTelemetry);

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
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

function resolvePort(value, fallback = 5000) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

const PORT = resolvePort(process.env.PORT, 5000);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AYUDIET backend server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
};
