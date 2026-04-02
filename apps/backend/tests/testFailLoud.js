function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveFromTests(relativePath) {
  return require.resolve(relativePath, { paths: [__dirname] });
}

function mockModules(mocks) {
  const originals = [];

  Object.keys(mocks).forEach((relativePath) => {
    const absolutePath = resolveFromTests(relativePath);
    originals.push({
      absolutePath,
      entry: require.cache[absolutePath],
    });

    require.cache[absolutePath] = {
      id: absolutePath,
      filename: absolutePath,
      loaded: true,
      exports: mocks[relativePath],
    };
  });

  return () => {
    originals.forEach(({ absolutePath, entry }) => {
      if (entry) {
        require.cache[absolutePath] = entry;
      } else {
        delete require.cache[absolutePath];
      }
    });
  };
}

function clearModule(relativePath) {
  const absolutePath = resolveFromTests(relativePath);
  delete require.cache[absolutePath];
}

function delayTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function testDbFailureThrows() {
  const restore = mockModules({
    "../src/services/db/pg.service": {
      query: async () => {
        throw new Error("db_down");
      },
    },
  });

  clearModule("../src/repositories/preference.repository");
  const preferenceRepository = require("../src/repositories/preference.repository");

  let threw = false;
  try {
    await preferenceRepository.upsertPreference("fail_loud_user", { protein: 1 });
  } catch (err) {
    threw = true;
    assert(err instanceof Error, "Expected upsertPreference to throw Error on DB failure");
  }

  restore();
  assert(threw, "Expected DB failure to throw");
}

async function testCacheCorruptionPurgesAndThrows() {
  const logs = [];
  const metricCalls = [];
  const deletedKeys = [];

  const restore = mockModules({
    "../src/services/cache/redis.service": {
      get: async () => "{bad-json",
      set: async () => true,
      del: async (key) => {
        deletedKeys.push(key);
        return 1;
      },
    },
    "../src/observability/logger": {
      logError: (payload) => {
        logs.push(payload);
      },
    },
    "../src/observability/metrics": {
      recordError: (metricName) => {
        metricCalls.push(metricName);
      },
    },
  });

  clearModule("../src/repositories/context.repository");
  const contextRepository = require("../src/repositories/context.repository");

  let threw = false;
  try {
    await contextRepository.getContext("corrupt_user");
  } catch (err) {
    threw = true;
    assert(err.message === "Corrupted context cache", "Expected corrupted cache error");
  }

  restore();

  assert(threw, "Expected context parse corruption to throw");
  assert(deletedKeys.length === 1, "Expected corrupted cache key purge");
  assert(String(deletedKeys[0]) === "ctx:corrupt_user", "Expected purge of user context key");
  assert(logs.some((entry) => String(entry.message || "").includes("Context parse failure")), "Expected parse failure log");
  assert(metricCalls.length >= 1, "Expected parse failure metric increment");
}

async function testTelemetryFailureLogsWithoutCrash() {
  const logs = [];
  const metricCalls = [];

  const restore = mockModules({
    "../src/repositories/adherence.repository": {
      getAdherenceSync: () => null,
      upsertAdherenceSync: () => true,
      upsertAdherence: async () => {
        throw new Error("telemetry_write_failed");
      },
    },
    "../src/observability/logger": {
      logError: (payload) => {
        logs.push(payload);
      },
    },
    "../src/observability/metrics": {
      recordError: (metricName) => {
        metricCalls.push(metricName);
      },
    },
  });

  clearModule("../src/modules/adaptive/adherence.service");
  const adherenceService = require("../src/modules/adaptive/adherence.service");

  let threw = false;
  try {
    adherenceService.trackAdherence("telemetry_user", { event_type: "FOLLOWED", date: "2026-04-02" });
    await delayTick();
  } catch (err) {
    threw = true;
  }

  restore();

  assert(!threw, "Expected telemetry failure path to avoid crash");
  assert(logs.some((entry) => String(entry.message || "").includes("Adherence persistence failed")), "Expected adherence failure log");
  assert(metricCalls.length >= 1, "Expected adherence failure metric increment");
}

(async () => {
  await testDbFailureThrows();
  await testCacheCorruptionPurgesAndThrows();
  await testTelemetryFailureLogsWithoutCrash();
  console.log("PASS: fail-loud persistence and telemetry behavior verified");
})();
