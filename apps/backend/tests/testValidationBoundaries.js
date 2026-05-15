const { adaptDecisionRequest } = require("../src/api/adapters/decisionRequest.adapter");
const { validateDecisionRequest } = require("../src/contracts/validators/index");

function log(msg) { console.log(msg); }
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  log(`PASS: ${message}`);
}

async function runTest() {
  log("=== Testing Strict Fail-Loud Boundaries ===");

  const validRequest = {
    version: "DecisionRequest_v1",
    schema_version: 1,
    compatibility: "backward",
    request_id: "req_test",
    trace_id: "trace_test",
    user_state: {
      user_id: "u1",
      goals: ["weight_loss"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.2, pitta: 0.5, kapha: 0.3 },
      allergies: [],
      preferences: [],
      context: { meal_type: "lunch", season: "summer" }
    },
    constraints: {
      max_calories: 600,
      diet_type: "vegetarian"
    },
    meta: {
      timestamp: 12345678,
      request_source: "tests",
      cache_allowed: true
    }
  };

  try {
    const valid = validateDecisionRequest(validRequest);
    assert(valid.valid, "AJV Schema respects completely valid fields");

    // Case 1: Missing Required Field implicitly passed to Adapter
    try {
      const missingUserId = JSON.parse(JSON.stringify(validRequest));
      delete missingUserId.user_state.user_id;
      adaptDecisionRequest(missingUserId);
      assert(false, "Case 1: Adapter should reject missing user_id");
    } catch (err) {
      assert(err.message === "Missing required field: user_id", "Case 1: Correctly intercepted adapter user_id missing error");
    }

    // Case 2: Invalid Dosha Estimate Field Type
    try {
      const invalidDosha = JSON.parse(JSON.stringify(validRequest));
      invalidDosha.user_state.dosha_estimate.vata = "high";
      adaptDecisionRequest(invalidDosha);
      assert(false, "Case 2: Adapter should reject invalid schema dosha property structure");
    } catch (err) {
      assert(err.message === "Missing or invalid required field: dosha_estimate.vata", "Case 2: Intercepted explicit missing field evaluation in normalization");
    }

    // Case 3: Proper Schema validation
    const invalidSchema = JSON.parse(JSON.stringify(validRequest));
    delete invalidSchema.constraints.max_calories;
    const schemaTest = validateDecisionRequest(invalidSchema);
    assert(!schemaTest.valid, "Case 3: Missing constraints max_calories directly captured by AJV validation before it hits adapter");

    // Case 4: Complete normal case with clean Optional evaluation
    const cleanAdapted = adaptDecisionRequest(validRequest);
    assert(cleanAdapted.userState.user_id === "u1", "Case 4: Handled user_id");
    assert(cleanAdapted.userState.goals[0] === "weight_loss", "Case 4: Extracted goals efficiently");
    assert(cleanAdapted.userState.goal_vector === undefined, "Case 4: goal_vector successfully omitted statically without synthetic rendering");
    assert(cleanAdapted.rules_version === undefined, "Case 4: rules_version remains strictly optional and avoids default assignment");
    
    log("\nALL TESTS PASSED.");
  } catch (err) {
    if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
    else console.error(err);
    process.exit(1);
  }
}

runTest();
