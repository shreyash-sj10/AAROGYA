/**
 * Contract Safety & Trace Integrity Test Suite
 * Verifies that the backend remains 100% contract-compliant under all failure and edge-case scenarios.
 */

const { buildErrorResponse } = require("../src/contracts/errorBuilder");
const { buildDecisionResponse } = require("../src/contracts/builders/decisionResponse.builder");
const { validateErrorResponse } = require("../src/contracts/validators/validateErrorResponse");
const { validateDecisionResponse } = require("../src/contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../src/contracts/validators/validateTrace");

async function runTests() {
  console.log("🚀 Starting Contract Safety Verification...\n");

  // CASE 1: Normal Execution Simulation
  console.log("--- CASE 1: Normal Plan Execution ---");
  try {
    const response = buildDecisionResponse({
      request: {
        request_id: "req_normal",
        trace_id: "trace_normal",
        meta: { timestamp: Date.now() }
      },
      internal: {
        mealPlan: [{ recipe_id: "dish_1", name: "Dish 1", quantity: { value: 200, unit: "g" } }],
        score: 0.95,
        confidence: { value: 0.9, level: "high", components: { penalty_impact: 1, diversity_impact: 1, relaxation_impact: 1 } },
        explanation: { deterministic: "Optimal choice" },
        meta: { latency_ms: 150, model_version: "v1", prompt_version: "p1", rules_version: "r1" }
      },
      stageStats: {
        interpretation_layer: { ml_used: true, ml_confidence: 0.8, ml_contribution_weight: 0.2 },
        candidate_generator: { input_count: 1, output_count: 10 },
        constraint_engine: { input_count: 10, output_count: 8, p0_rules_checked: 5 },
        scoring_engine: { input_count: 8, output_count: 8 },
        diversity_engine: { input_count: 8, output_count: 8 },
        optimizer: { input_count: 8, output_count: 1, combinations_evaluated: 20, selected_score: 0.95 },
        reliability_engine: { input_count: 1, output_count: 1 }
      }
    });
    
    const v = validateDecisionResponse(response);
    const vt = validateTrace(response.trace);
    if (v.valid && vt.valid) {
      console.log("✅ PASSED: Normal response is schema-compliant.");
      console.log(`   Trace stages: ${Object.keys(response.trace.stages).length} (Expected 7)`);
    } else {
      console.error("❌ FAILED: Normal response validation failed", v.errors, vt.errors);
    }
  } catch (e) {
    console.error("❌ FAILED: Case 1 threw unexpected error", e.message);
  }
  console.log("");


  // CASE 2: Early Pipeline Failure (Pre-Constraint)
  console.log("--- CASE 2: Early Pipeline Failure (Pre-Constraint) ---");
  try {
    // Stage stats are empty because we failed before generating them
    const errResponse = buildErrorResponse({
      code: "PIPELINE_INIT_FAILED",
      message: "Failed to load template",
      request_id: "req_early",
      trace_id: "trace_early",
      trace: {}, // Empty trace from failed pipeline
      meta: { timestamp: Date.now() }
    });

    const v = validateErrorResponse(errResponse);
    const vt = validateTrace(errResponse.trace);
    
    if (v.valid && vt.valid) {
       console.log("✅ PASSED: Error response with empty trace is healed and schema-compliant.");
       console.log(`   Healed trace stages: ${Object.keys(errResponse.trace.stages).length} (Expected 7)`);
       console.log(`   Interpretation layer present: ${!!errResponse.trace.stages.interpretation_layer}`);
    } else {
       console.error("❌ FAILED: Error response validation failed", v.errors, vt.errors);
    }
  } catch (e) {
     console.error("❌ FAILED: Case 2 threw unexpected error", e.message);
  }
  console.log("");


  // CASE 3: Malformed Trace Injection
  console.log("--- CASE 3: Malformed Trace Injection ---");
  try {
    const partialTrace = {
      stages: {
        candidate_generator: { input_count: 1 }
        // Missing all other stages and nested required fields
      }
    };
    
    const errResponse = buildErrorResponse({
      code: "MALFORMED_INTERNAL",
      message: "Partial trace injected",
      trace: partialTrace,
      request_id: "req_malformed"
    });

    const v = validateErrorResponse(errResponse);
    const vt = validateTrace(errResponse.trace);
    
    if (v.valid && vt.valid) {
       console.log("✅ PASSED: Malformed partial trace was corrected and stabilized.");
       console.log(`   Constraint engine rules (default): ${Array.isArray(errResponse.trace.stages.constraint_engine.rules)}`);
    } else {
       console.error("❌ FAILED: Malformed trace validation failed", v.errors, vt.errors);
    }
  } catch (e) {
     console.error("❌ FAILED: Case 3 threw unexpected error", e.message);
  }
  console.log("");


  // CASE 4: LLM Failure (Missing interpretation_layer in pipeline result)
  console.log("--- CASE 4: LLM Failure (Partial stats) ---");
  try {
    const pipelineStatsWithMissingML = {
      candidate_generator: { input_count: 1, output_count: 10 },
      // interpretation_layer is missing because service crashed
      constraint_engine: { input_count: 10, output_count: 10 }
    };

    const response = buildDecisionResponse({
      request: { request_id: "req_llm_fail", trace_id: "trace_llm_fail", meta: { timestamp: Date.now() } },
      internal: {
        mealPlan: [{ recipe_id: "dish_1", name: "Dish 1", quantity: { value: 200, unit: "g" } }],
        score: 0.8,
        confidence: { value: 0.5, level: "medium", components: { penalty_impact: 1, diversity_impact: 1, relaxation_impact: 1 } },
        explanation: { deterministic: "AI fallback" },
        meta: { latency_ms: 50, model_version: "v1", prompt_version: "p1", rules_version: "r1" }
      },
      stageStats: pipelineStatsWithMissingML
    });

    const v = validateDecisionResponse(response);
    const vt = validateTrace(response.trace);
    
    if (v.valid && vt.valid) {
       console.log("✅ PASSED: LLM failure handled; interpretation_layer restored with safe defaults.");
       console.log(`   ml_used (default): ${response.trace.stages.interpretation_layer.ml_used}`);
    } else {
       console.error("❌ FAILED: LLM failure response validation failed");
       if (!v.valid) console.error("   DecisionResponse errors:", JSON.stringify(v.errors, null, 2));
       if (!vt.valid) console.error("   Trace errors:", JSON.stringify(vt.errors, null, 2));
    }
  } catch (e) {
     console.error("❌ FAILED: Case 4 threw unexpected error", e.message);
  }
  
  console.log("\n🏁 Verification Complete.");
}

runTests().catch(err => {
  console.error("💣 CRITICAL TEST FAILURE:", err);
  process.exit(1);
});
