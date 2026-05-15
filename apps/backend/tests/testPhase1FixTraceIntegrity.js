const { generateWeeklyPlan } = require("../src/modules/planner/weeklyPlanner.service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const result = await generateWeeklyPlan({
    user_context: {
      user_id: "phase1_fix_trace",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: [],
      preferences: [],
      diet_type: "vegetarian",
      context: { season: "summer" },
    },
    constraints: {
      max_calories: 700,
      diet_type: "vegetarian",
      season: "summer",
    },
    preferences: {},
    days: 7,
  });

  const traceSummary = result.trace_summary || {};
  const stages = traceSummary.stages || {};
  const ce = stages.constraint_engine || {};

  assert(Number.isInteger(ce.p0_rules_checked) && ce.p0_rules_checked >= 0, "constraint trace missing p0_rules_checked");
  assert(Number.isInteger(ce.p0_violations) && ce.p0_violations >= 0, "constraint trace missing p0_violations");
  assert(Array.isArray(ce.p0_violated_rule_ids), "constraint trace missing p0_violated_rule_ids");

  assert(Number.isInteger(traceSummary.p0_passed) && traceSummary.p0_passed >= 0, "trace_summary missing p0_passed");
  assert(Number.isInteger(traceSummary.p0_failed) && traceSummary.p0_failed >= 0, "trace_summary missing p0_failed");
  assert(Array.isArray(traceSummary.violations), "trace_summary missing violations");

  assert(traceSummary.p0_failed === ce.p0_violations, "trace_summary.p0_failed does not reflect constraint_engine.p0_violations");
  assert(JSON.stringify(traceSummary.violations) === JSON.stringify(ce.p0_violated_rule_ids), "trace_summary.violations does not reflect constraint_engine.p0_violated_rule_ids");

  console.log("PASS: trace integrity uses real aggregated constraint outputs");
})();
