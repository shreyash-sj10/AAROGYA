const { detectUncertainty, selectNextQuestion } = require("../src/modules/refinement/refinementEngine");
const assert = require("assert");

/**
 * AAROGYA Phase 5: Refinement Verification
 * Verifies deterministic question triggering for low-quality inputs.
 */

const mockRequest = {
  version: "DecisionRequest_v1",
  user_state: {
    user_id: "test_user",
    goals: ["Energy"],
    symptoms: [], // EMPTY - should trigger CLARIFY_SYMPTOMS
    dosha_estimate: { vata: 0.333333, pitta: 0.333333, kapha: 0.333334 } // DEFAULT - should trigger CLARIFY_PITTA
  }
};

const mockResponse = {
  confidence: { value: 0.5 }, // LOW - should trigger refinement
  trace: {
    safe: {
      stages: {
        reliability_engine: { relaxation_level: 0 }
      }
    }
  }
};

console.log("--- Starting Refinement Verification ---");

// Test 1: Missing Symptoms
const signals1 = detectUncertainty(mockRequest, mockResponse);
console.log("[Test 1] Detected Signals:", signals1);
assert(signals1.includes("MISSING_SYMPTOMS"), "Should detect MISSING_SYMPTOMS");
const question1 = selectNextQuestion(signals1);
console.log("[Test 1] Triggered Question:", question1.id);
assert.strictEqual(question1.id, "clarify_symptoms", "Should prioritize symptoms clarification");

// Test 2: Symptoms provided, but Dosha is default
mockRequest.user_state.symptoms = ["Acidity"];
const signals2 = detectUncertainty(mockRequest, mockResponse);
console.log("[Test 2] Detected Signals:", signals2);
assert(signals2.includes("DEFAULT_DOSHA"), "Should detect DEFAULT_DOSHA");
const question2 = selectNextQuestion(signals2);
console.log("[Test 2] Triggered Question:", question2.id);
assert.strictEqual(question2.id, "clarify_pitta", "Should prioritize pitta clarification");

// Test 3: Everything provided, but confidence is still low
mockRequest.user_state.dosha_estimate = { vata: 0.5, pitta: 0.3, kapha: 0.2 };
const signals3 = detectUncertainty(mockRequest, mockResponse);
console.log("[Test 3] Detected Signals:", signals3);
assert(signals3.includes("LOW_CONFIDENCE"), "Should detect LOW_CONFIDENCE");
const question3 = selectNextQuestion(signals3);
console.log("[Test 3] Triggered Question:", question3 ? question3.id : "None");

// Test 4: Complete and High Confidence input
mockResponse.confidence.value = 0.9;
const signals4 = detectUncertainty(mockRequest, mockResponse);
console.log("[Test 4] Detected Signals:", signals4);
const question4 = selectNextQuestion(signals4);
console.log("[Test 4] Triggered Question:", question4 ? question4.id : "None (Success)");
assert.strictEqual(question4, null, "Should return null for high confidence decisions");

console.log("\n✅ All Refinement Triggers Passed (Deterministic & Priority-Safe)");
