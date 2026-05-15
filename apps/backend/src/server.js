require("dotenv").config();

const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

function describeDatabaseUrl(url) {
  if (!url || typeof url !== "string" || !url.trim()) {
    return "missing";
  }
  try {
    const u = new URL(url);
    const host = u.hostname || "unknown_host";
    const db = u.pathname ? u.pathname.replace(/^\//, "") : "";
    return `configured host=${host}${db ? ` db=${db}` : ""}`;
  } catch (_err) {
    return "configured (unparseable URL; redacted)";
  }
}

console.log(`[Startup] DATABASE_URL ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
if (!process.env.DATABASE_URL) {
  console.warn("[Startup] DATABASE_URL missing. Running in degraded mode without DB.");
}

const REQUIRE_DB = process.env.REQUIRE_DB === "true";
const dbService = require("./services/db/pg.service");
const { initializeFoodRepository } = require("./repositories/food.repository");
const { initializeRuleRepository, getRules } = require("./repositories/rule.repository");
const { initializeTemplateRepository } = require("./repositories/template.repository");
const { validateAdaptiveActivation } = require("./core/pipeline/orchestrator");
const express = require("express");
const cors = require("cors");
const { registerApiRoutes } = require("./api/routes");
const { apiTelemetry } = require("./api/middleware/apiTelemetry");
const { buildErrorResponse } = require("./contracts/errorBuilder");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const { assertCanonicalRulebaseIntegrity, validateRuleSetOrThrow } = require("./rules/engine/constraintEngine");

assertCanonicalRulebaseIntegrity();

async function validateDbCatalog() {
  if (!process.env.DATABASE_URL) {
    if (REQUIRE_DB) {
      throw new Error("[DB] DATABASE_URL missing while REQUIRE_DB=true");
    }
    return;
  }

  const requiredTables = [
    "food_catalog",
    "rule_catalog",
    "meal_templates",
    "preferences",
    "user_meal_history",
    "user_weekly_adherence",
    "daily_state",
    "weekly_plans",
    "users",
  ];

  const missingTables = [];
  for (const table of requiredTables) {
    const exists = await dbService.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1",
      [table]
    );

    if (!exists.rows || exists.rows.length === 0) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    const msg = `[DB] missing tables: ${missingTables.join(", ")}`;
    console.error(msg);
    if (REQUIRE_DB) {
      throw new Error(msg);
    }
  }

  const minRowsTables = ["food_catalog", "rule_catalog", "meal_templates"];
  for (const table of minRowsTables) {
    const countResult = await dbService.query(`SELECT COUNT(*)::int AS c FROM ${table}`, []);
    const count = Number(countResult?.rows?.[0]?.c || 0);
    if (count <= 0) {
      const msg = `[DB] ${table} has empty catalog`;
      console.error(msg);
      if (REQUIRE_DB) {
        throw new Error(msg);
      }
    }
  }
}

function parseCorsOrigins(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS || "");
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && configuredOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must be configured in production");
}

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (configuredOrigins.length > 0 && configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (!isProduction && configuredOrigins.length === 0) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS blocked: origin not allowed"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
const { requestContextMiddleware } = require("./observability/requestContext");
app.use(requestContextMiddleware);
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

let httpServer = null;

async function gracefulShutdown(signal) {
  const { rootLogger } = require("./observability/pinoRoot");
  rootLogger.info({ event: "shutdown_start", signal }, "graceful_shutdown");

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
    httpServer = null;
  }

  try {
    const redisService = require("./services/cache/redis.service");
    if (typeof redisService.shutdownRedis === "function") {
      await redisService.shutdownRedis();
    }
  } catch (_e) {
    /* ignore */
  }

  try {
    await dbService.shutdownPool();
  } catch (_e) {
    /* ignore */
  }

  try {
    await new Promise((resolve) => {
      rootLogger.flush(resolve);
    });
  } catch (_e) {
    /* ignore */
  }

  rootLogger.info({ event: "shutdown_complete", signal }, "graceful_shutdown");
  process.exit(0);
}

async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      await dbService.query("SELECT 1", []);
      console.log("[DB] connected");
      await validateDbCatalog();
    } catch (error) {
      console.error(`[DB] failed (${error instanceof Error ? error.message : "unknown error"})`);
      if (REQUIRE_DB) {
        throw error;
      }
    }
  } else {
    console.warn("[DB] failed (DATABASE_URL missing)");
    if (REQUIRE_DB) {
      throw new Error("[DB] DATABASE_URL missing while REQUIRE_DB=true");
    }
  }

  try {
    await Promise.all([
      initializeFoodRepository(),
      initializeRuleRepository(),
      initializeTemplateRepository(),
    ]);
  } catch (error) {
    console.warn(`[Startup] data source bootstrap fallback: ${error instanceof Error ? error.message : "unknown"}`);
    if (REQUIRE_DB) {
      throw error;
    }
  }

  validateRuleSetOrThrow(getRules(), {
    label: "default_rulebase",
    requireP0: true,
  });

  try {
    validateAdaptiveActivation();
  } catch (error) {
    console.warn(`[ADAPTIVE] inactive (${error instanceof Error ? error.message : "unknown"})`);
  }

  await new Promise((resolve, reject) => {
    try {
      httpServer = app.listen(PORT, () => {
        console.log(`AAROGYA backend server running on http://localhost:${PORT}`);
        resolve();
      });
      httpServer.on("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
          console.error(
            `[Server] Port ${PORT} is already in use. Stop the other process or run: npm run dev:kill-ports (from apps/backend), then npm run dev again.`,
          );
          console.error(
            "[Server] Tip: use only one backend — repo root `npm run dev` OR `apps/backend` `npm run dev`, not both.",
          );
        }
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

if (require.main === module) {
  void startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      void gracefulShutdown(signal).catch(() => {
        process.exit(1);
      });
    });
  });
}

module.exports = {
  app,
  startServer,
};
