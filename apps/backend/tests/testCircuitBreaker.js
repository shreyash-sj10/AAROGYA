function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  process.env.AYUDIET_AI_CB_THRESHOLD = "2";
  process.env.AYUDIET_AI_CB_COOLDOWN_MS = "1000";

  const modulePath = require.resolve("../src/services/ml/mlClient");
  delete require.cache[modulePath];

  let now = 1_000_000;
  const originalDateNow = Date.now;
  Date.now = () => now;

  let mode = "fail";
  let aiCallCount = 0;
  let observedHalfOpen = false;

  global.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/health")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { status: "ok" };
        },
      };
    }

    if (target.includes("/ai/")) {
      aiCallCount += 1;
    }

    const { _circuitState } = require("../src/services/ml/mlClient");
    if (target.includes("/ai/") && _circuitState.state === "half_open") {
      observedHalfOpen = true;
    }

    if (mode === "fail") {
      throw new Error("simulated_ai_failure");
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          data: {
            ok: true,
          },
        };
      },
    };
  };

  const { safeFetch, _circuitState } = require("../src/services/ml/mlClient");

  try {
    await safeFetch("http://localhost:8000/ai/profile", { text: "a" }, { request_id: "cb_fail_1" });
  } catch (error) {
    // expected
  }

  try {
    await safeFetch("http://localhost:8000/ai/profile", { text: "b" }, { request_id: "cb_fail_2" });
  } catch (error) {
    // expected
  }

  assert(_circuitState.state === "open", "Circuit should open after threshold failures");

  const callsBeforeOpenCheck = aiCallCount;
  try {
    await safeFetch("http://localhost:8000/ai/profile", { text: "c" }, { request_id: "cb_open_skip" });
  } catch (error) {
    assert(String(error.message || error).includes("service unavailable"), "Open circuit should reject immediately");
  }
  assert(aiCallCount === callsBeforeOpenCheck, "Open circuit should skip outbound AI calls");

  now += 1001;
  mode = "success";

  const successResult = await safeFetch("http://localhost:8000/ai/profile", { text: "d" }, { request_id: "cb_recover" });

  assert(observedHalfOpen, "Circuit should transition to half_open after cooldown before recovery call");
  assert(successResult && successResult.ok === true, "Successful recovery call should return data");
  assert(_circuitState.state === "closed", "Successful call in half_open should reset circuit to closed");
  assert(_circuitState.failureCount === 0, "Successful call should reset failure count");

  Date.now = originalDateNow;

  console.log("PASS: circuit breaker opens, skips calls, transitions through half_open, and recovers to closed");
})();
