/**
 * Phase 1 aggregate — determinism + P0 + startup/contracts + Phase 5 recipe-first + Phase 6 optimizer.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scripts = [
  "scripts/run-determinism-ci.js",
  "scripts/run-p0-ci.js",
  "scripts/run-startup-contracts-ci.js",
];

for (const rel of scripts) {
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

const recipeFirst = spawnSync(process.execPath, [path.join(root, "tests", "testRecipeFirstPipeline.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});
if (recipeFirst.status !== 0) {
  process.exit(recipeFirst.status ?? 1);
}

const phase6 = spawnSync(process.execPath, [path.join(root, "tests", "testPhase6Optimizer.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});
if (phase6.status !== 0) {
  process.exit(phase6.status ?? 1);
}

process.exit(0);
