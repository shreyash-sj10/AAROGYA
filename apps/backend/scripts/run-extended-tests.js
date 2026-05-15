/**
 * Tiered tests that run without PostgreSQL (fallback JSON catalogs).
 * Used by npm run test:extended — keep each file exit 0 on a clean clone without DATABASE_URL.
 * Startup + rule-schema alignment live under `npm run test:phase1` (Phase 1.3–1.4).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/testHealthDegradedDb.js",
  "tests/testValidationBoundaries.js",
  "tests/testTraceNoHealing.js",
  "tests/testMetrics.js",
  "tests/testAIBoundary.js",
  "tests/testRecipeFirstPipeline.js",
];

for (const rel of tests) {
  const target = path.join(root, rel);
  const r = spawnSync(process.execPath, [target], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

process.exit(0);
