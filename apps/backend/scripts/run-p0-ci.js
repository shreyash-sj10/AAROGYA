/**
 * Phase 1.2 — P0 safety CI (hermetic, no PostgreSQL).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/p0/testMaliciousAiProfileBoundary.js",
  "tests/testP0Enforcement.js",
  "tests/testP0ConstraintCatalog.js",
  "tests/testP0SafetyProof.js",
  "tests/testFallbackP0Safety.js",
  "tests/testFailLoudNoPlan.js",
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
