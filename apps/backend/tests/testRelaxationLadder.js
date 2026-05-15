const { executeGeneratePlanCore } = require("../src/core/pipeline/orchestrator");

function log(msg) { console.log(msg); }

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  log(`PASS: ${message}`);
}

async function runTest() {
  log("=== Testing Relaxation Ladder ===");

  const customFoodsTemplate = [
    { id: "g1", recipe_id: "g1", name: "Grain", category: "grain", meta: { fail_p3: false, fail_p2: false, fail_p1: false } },
    { id: "v1", recipe_id: "v1", name: "Veg", category: "vegetable", meta: { fail_p3: false, fail_p2: false, fail_p1: false } },
    { id: "d1", recipe_id: "d1", name: "Dal", category: "dal", meta: { fail_p3: false, fail_p2: false, fail_p1: false } },
  ];

  const ruleP3 = { id: "rule_p3", type: "hard_constraint", priority: "P3", action: { type: "reject" },
    logic_tree: { logic: "AND", conditions: [{ entity: "food.meta.fail_p3", operator: "==", value: true }] }
  };
  const ruleP2 = { id: "rule_p2", type: "hard_constraint", priority: "P2", action: { type: "reject" },
    logic_tree: { logic: "AND", conditions: [{ entity: "food.meta.fail_p2", operator: "==", value: true }] }
  };
  const ruleP1 = { id: "rule_p1", type: "hard_constraint", priority: "P1", action: { type: "reject" },
    logic_tree: { logic: "AND", conditions: [{ entity: "food.meta.fail_p1", operator: "==", value: true }] }
  };
  const ruleP0 = { id: "rule_p0", type: "hard_constraint", priority: "P0", action: { type: "reject" },
    logic_tree: { logic: "AND", conditions: [{ entity: "food.meta.fail_p0", operator: "==", value: true }] }
  };

  const getReq = (foods) => ({
    request_id: "req_test", trace_id: "trace_test", mealType: "lunch",
    userState: { userId: "u1", context: {} }, constraints: {}, meta: {},
    foods, rules: [ruleP0, ruleP1, ruleP2, ruleP3],
  });

  const run = async (foods) => {
    const res = await executeGeneratePlanCore(getReq(foods));
    return res.trace.stages.reliability_engine;
  };

  try {
    // T1: Strict
    const t1 = await run(customFoodsTemplate);
    assert(t1.relaxation_level === 0, "T1: Strict (relaxation=0)");

    // T2: Fail P3 -> L1
    const t2 = await run(customFoodsTemplate.map(f => ({ ...f, meta: { fail_p3: true } })));
    assert(t2.relaxation_level === 1, "T2: L1 (P3 relaxed)");
    assert(t2.relaxed_priorities.includes("P3"), "T2: P3 is in relaxed_priorities");

    // T3: Fail P2 -> L2
    const t3 = await run(customFoodsTemplate.map(f => ({ ...f, meta: { fail_p2: true } })));
    assert(t3.relaxation_level === 2, "T3: L2 (P2 relaxed)");
    assert(t3.relaxed_priorities.includes("P2"), "T3: P2 is in relaxed_priorities");

    // T4: Fail P1 -> L3
    const t4 = await run(customFoodsTemplate.map(f => ({ ...f, meta: { fail_p1: true } })));
    assert(t4.relaxation_level === 3, "T4: L3 (P1 relaxed)");
    assert(t4.relaxed_priorities.includes("P1"), "T4: P1 is in relaxed_priorities");

    // T5: Fallback (Even P0 fails on custom foods, Fallback throws NO_SAFE_MEAL_FOUND)
    try {
      await run(customFoodsTemplate.map(f => ({ ...f, meta: { fail_p0: true } })));
      assert(false, "T5: Expected NO_SAFE_MEAL_FOUND error but it passed!");
    } catch (err) {
      assert(err.message === "Safe fallback could not find any P0-valid meal", "T5: Fallback threw Safe fallback could not find any P0-valid meal as expected");
    }
    
    log("\nALL TESTS PASSED.");
  } catch (err) {
    if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
    else console.error(err);
    process.exit(1);
  }
}
runTest();
