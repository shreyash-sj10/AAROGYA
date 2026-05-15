/**
 * Phase 1.1 — determinism CI (hermetic, no PostgreSQL).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/determinism/testGoldenFixtureDeterminism.js",
  "tests/testDeterminismStrict.js",
  "tests/testPhase1Determinism.js",
  "tests/testReplaySystem.js",
  "tests/testDeterminism.js",
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
