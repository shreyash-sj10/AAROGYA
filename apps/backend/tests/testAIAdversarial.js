function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(fn, expectedMessage) {
  let rejected = false;

  try {
    await fn();
  } catch (error) {
    rejected = true;
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(expectedMessage),
      `Expected error to include "${expectedMessage}", got: ${message}`
    );
  }

  assert(rejected, `Expected function to reject with message containing "${expectedMessage}"`);
}

let scenario = "malformed_json";

function createResponse({ ok = true, status = 200, jsonValue, jsonThrows } = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonThrows) {
        throw new Error(jsonThrows);
      }
      return jsonValue;
    },
  };
}

global.fetch = async (url) => {
  const target = String(url);

  if (target.endsWith("/health")) {
    return createResponse({ jsonValue: { status: "ok" } });
  }

  if (scenario === "malformed_json" && target.endsWith("/ai/explain")) {
    return createResponse({ ok: true, status: 200, jsonThrows: "invalid json" });
  }

  if (scenario === "nested_forbidden" && target.endsWith("/ai/explain")) {
    return createResponse({
      ok: true,
      status: 200,
      jsonValue: {
        success: true,
        data: {
          explanation: "Seems good",
          citations: [],
          deep: { nested: { meal: "unsafe" } },
        },
      },
    });
  }

  if (scenario === "unexpected_field" && target.endsWith("/ai/profile")) {
    return createResponse({
      ok: true,
      status: 200,
      jsonValue: {
        success: true,
        data: {
          risk_flags: [],
          goals: [],
          symptoms: [],
          dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
          confidence: 0.8,
          unexpected: "forbidden",
        },
      },
    });
  }

  return createResponse({ ok: false, status: 500, jsonValue: { success: false } });
};

const { getExplanation, getAIProfile } = require("../src/services/ml/mlClient");

(async () => {
  await assertRejects(
    () => getExplanation({
      context: {
        risk_flags: [],
        selected_recipes: [],
        user_conditions: [],
        highlights: [],
        warnings: [],
      },
      reasoning: {
        trace: [],
        total_score: 0.6,
      },
    }, { request_id: "ai_adversarial_malformed" }),
    "AI Boundary Error: invalid response"
  );

  scenario = "nested_forbidden";

  await assertRejects(
    () => getExplanation({
      context: {
        risk_flags: [],
        selected_recipes: ["r1"],
        user_conditions: [],
        highlights: ["h"],
        warnings: [],
      },
      reasoning: {
        trace: ["ok"],
        total_score: 0.7,
      },
    }, { request_id: "ai_adversarial_forbidden" }),
    "AI Boundary Error: forbidden decision field: meal"
  );

  scenario = "unexpected_field";

  await assertRejects(
    () => getAIProfile("profile please", { request_id: "ai_adversarial_unexpected" }),
    "AI Boundary Error: profile response schema validation failed"
  );

  console.log("PASS: adversarial AI responses are rejected (malformed JSON, forbidden nested keys, unexpected fields)");
})();
