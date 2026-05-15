const fs = require("fs");
const path = require("path");

const FRONTEND_ROOT = path.resolve(__dirname, "..", "src");
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const LEGACY_ENDPOINTS = [
  ["/ai/", "knowledge"],
  ["/assistant/", "action"],
  ["/rag/", "explain"],
];

const DIRECT_AI_PATTERNS = [
  "fetch('/ai/",
  "fetch(\"/ai/",
  "axios('/ai/",
  "axios(\"/ai/",
];

const ALLOWED_PATH_CALLERS = new Set([
  path.resolve(FRONTEND_ROOT, "ai", "aiRouter.ts"),
]);

const violations = [];

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!ALLOWED_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function collectViolations(files) {
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");

    for (const [prefix, suffix] of LEGACY_ENDPOINTS) {
      const legacy = `${prefix}${suffix}`;
      if (content.includes(legacy)) {
        violations.push({ file, type: "legacy_endpoint", token: legacy });
      }
    }

    for (const token of DIRECT_AI_PATTERNS) {
      if (content.includes(token) && !ALLOWED_PATH_CALLERS.has(path.resolve(file))) {
        violations.push({ file, type: "direct_ai_fetch", token });
      }
    }
  }
}

const frontendFiles = walk(FRONTEND_ROOT);
collectViolations(frontendFiles);

if (violations.length > 0) {
  console.error("Strict AI endpoint validation failed:");
  for (const violation of violations) {
    const relative = path.relative(path.resolve(__dirname, ".."), violation.file).replace(/\\/g, "/");
    console.error(`- ${violation.type}: ${relative} -> ${violation.token}`);
  }
  process.exit(1);
}

console.log("Strict AI endpoint validation passed.");
