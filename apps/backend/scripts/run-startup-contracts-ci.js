/**
 * Phase 1.3–1.4 — startup + contract schema CI (hermetic).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/testStartupRuleValidation.js",
  "tests/testRuleSchemaAlignment.js",
  "tests/startup/testContractSchemaSmoke.js",
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
