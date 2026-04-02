function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createResponse(ok, payload, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
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
      `Expected error to include \"${expectedMessage}\", got: ${message}`
    );
  }

  assert(rejected, `Expected function to reject with message containing \"${expectedMessage}\"`);
}

let scenario = "invalid_profile";

global.fetch = async (url) => {
  const target = String(url);

  if (target.endsWith("/health")) {
    return createResponse(true, { status: "ok" });
  }

  if (scenario === "invalid_profile" && target.endsWith("/ai/profile")) {
    return createResponse(true, {
      success: true,
      data: {
        risk_flags: "not-an-array",
        dosha_estimate: { vata: 0.4, pitta: 0.3, kapha: 0.3 },
        confidence: 0.9,
      },
    });
  }

  if (scenario === "forbidden_nested" && target.endsWith("/ai/explain")) {
    return createResponse(true, {
      success: true,
      data: {
        explanation: "Deterministic text",
        citations: [],
        nested: { meal: "pizza" },
      },
    });
  }

  return createResponse(false, { success: false }, 500);
};

const { getAIProfile, getExplanation } = require("../src/services/ml/mlClient");

(async () => {
  await assertRejects(
    () => getAIProfile("user has acidity", { request_id: "test_profile_invalid" }),
    "AI Boundary Error: profile response schema validation failed"
  );

  scenario = "forbidden_nested";

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
        total_score: 0.5,
      },
    }, { request_id: "test_forbidden_nested" }),
    "AI Boundary Error: forbidden decision field: meal"
  );

  console.log("PASS: deep AI boundary rejects invalid responses and nested forbidden keys");
})();