const http = require("http");

const TARGET_URL = process.env.LOADTEST_URL || "http://127.0.0.1:3000/plan";
const CONCURRENCY = Number(process.env.LOADTEST_CONCURRENCY || 100);
const REQUESTS = Number(process.env.LOADTEST_REQUESTS || 1000);

function oneRequest() {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      request_id: `load_${Date.now()}`,
      trace_id: `trace_${Date.now()}`,
      mealType: "lunch",
      userState: {
        user_id: "load_user",
        risk_flags: [],
        goals: ["GOAL_MAINTENANCE"],
        context: { meal_type: "lunch", season: "summer" },
      },
      foods: [],
      rules: [],
      userHistory: {},
    });

    const req = http.request(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 3000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });

    req.on("error", () => resolve(0));
    req.on("timeout", () => {
      req.destroy();
      resolve(0);
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const started = Date.now();
  let completed = 0;
  let failures = 0;
  const statuses = {};

  async function worker() {
    while (completed < REQUESTS) {
      completed += 1;
      const code = await oneRequest();
      statuses[code] = (statuses[code] || 0) + 1;
      if (code < 200 || code >= 300) {
        failures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const durationMs = Date.now() - started;

  console.log(JSON.stringify({
    requests: REQUESTS,
    concurrency: CONCURRENCY,
    duration_ms: durationMs,
    rps: REQUESTS / Math.max(1, durationMs / 1000),
    failures,
    statuses,
  }, null, 2));
}

run().catch((error) => {
  console.error("loadtest_failed", error.message);
  process.exitCode = 1;
});
