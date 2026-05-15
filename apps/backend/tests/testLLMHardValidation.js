const fs = require("fs");
const path = require("path");

const { getRAGExplanation } = require("../src/services/ml/ragClient");
const { handleUserQuery } = require("../src/core/assistant/handleUserQuery");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readFilesRecursive(rootDir, extList = [".js"]) {
  const out = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && extList.some((ext) => full.endsWith(ext))) {
        out.push(full);
      }
    }
  }

  walk(rootDir);
  return out;
}

function testNoLegacyEndpoints() {
  const backendRouteFiles = readFilesRecursive(path.join(__dirname, "../src/api/routes"));
  const aiServiceFiles = readFilesRecursive(path.join(__dirname, "../../ai-service/api"), [".py"]);

  const forbiddenLegacy = [
    ["/ai/", "knowledge"],
    ["/assistant/", "action"],
    ["/rag/", "explain"],
  ];

  for (const file of backendRouteFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const [a, b] of forbiddenLegacy) {
      const token = `${a}${b}`;
      assert(!content.includes(token), `Forbidden legacy endpoint token '${token}' found in ${file}`);
    }
  }

  for (const file of aiServiceFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const [a, b] of forbiddenLegacy) {
      const token = `${a}${b}`;
      assert(!content.includes(token), `Forbidden legacy endpoint token '${token}' found in ${file}`);
    }
  }
}

async function testRagPayloadValidation() {
  let threw = false;
  try {
    await getRAGExplanation({ query: "kapha", context: {} });
  } catch (error) {
    threw = error instanceof Error && error.message === "INVALID_RAG_PAYLOAD";
  }
  assert(threw, "Expected getRAGExplanation to throw INVALID_RAG_PAYLOAD when session_id is missing");
}

function testNoDirectLlmCalls() {
  const sourceFiles = readFilesRecursive(path.join(__dirname, "../src"));
  const forbiddenTokens = [
    "safeFetch(",
    "mlClient",
    "callML(",
    "fetch('/ai/",
    "fetch(\"/ai/",
    "axios('/ai/",
    "axios(\"/ai/",
  ];

  sourceFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    forbiddenTokens.forEach((token) => {
      assert(!content.includes(token), `Forbidden direct AI token '${token}' found in ${file}`);
    });
  });
}

async function testSessionIdRequired() {
  let threw = false;
  try {
    await handleUserQuery("What is kapha?", {
      user_profile: { prakriti: { kapha: 0.5, pitta: 0.3, vata: 0.2 } },
      symptoms: ["heaviness"],
      current_plan: { meals: [] },
    });
  } catch (error) {
    threw = error instanceof Error && error.message === "SESSION_ID_REQUIRED";
  }

  assert(threw, "Expected SESSION_ID_REQUIRED when handleUserQuery is called without session_id");
}

async function testMetaNoContextTruthfulness() {
  const result = await handleUserQuery("What is kapha?", {
    session_id: `meta_${Date.now()}`,
    user_profile: {},
    symptoms: [],
    current_plan: {},
  });

  assert(result && typeof result === "object", "Expected result object for no-context meta test");
  assert(result.meta && result.meta.fallback === true, "Expected fallback=true for no-context clarification");
  assert(result.meta && result.meta.reason === "no_context", "Expected reason=no_context for clarification");
  assert(typeof result.text === "string" && result.text.toLowerCase().includes("clarify"), "Expected clarification text for no_context");
}

function testTimeoutRetryMetaPolicyPresent() {
  const orchestratorFile = path.join(__dirname, "../src/core/assistant/handleUserQuery.js");
  const content = fs.readFileSync(orchestratorFile, "utf8");
  assert(content.includes("timeout_retry"), "Expected timeout_retry meta reason policy in handleUserQuery");
  assert(content.includes("safety_blocked"), "Expected safety_blocked meta reason policy in handleUserQuery");
}

(async () => {
  testNoLegacyEndpoints();
  await testRagPayloadValidation();
  testNoDirectLlmCalls();
  await testSessionIdRequired();
  await testMetaNoContextTruthfulness();
  testTimeoutRetryMetaPolicyPresent();
  console.log("testLLMHardValidation passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
