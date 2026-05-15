const { generateWeeklyPlan } = require("../src/modules/planner/weeklyPlanner.service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const result = await generateWeeklyPlan({
    user_context: {
      user_id: "phase1_final_trace",
      goals: ["maintenance"],
      risk_flags: [],
      symptoms: [],
      dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
      allergies: ["milk"],
      preferences: [],
      diet_type: "vegetarian",
      context: { season: "summer" },
      target_calories: 700,
    },
    constraints: {
      max_calories: 750,
      diet_type: "vegetarian",
      season: "summer",
    },
    preferences: {},
    days: 7,
  });

  const summary = result.trace_summary || {};
  const ce = ((summary.stages || {}).constraint_engine || {});

  assert(Number.isInteger(ce.p0_rules_checked) && ce.p0_rules_checked > 0, "weekly trace must include real p0_rules_checked > 0");
  assert(Number.isInteger(ce.p0_violations) && ce.p0_violations >= 0, "weekly trace missing p0_violations");
  assert(Array.isArray(ce.p0_violated_rule_ids), "weekly trace missing p0_violated_rule_ids");

  assert(summary.p0_failed === ce.p0_violations, "trace_summary.p0_failed must match constraint_engine.p0_violations");
  assert(JSON.stringify(summary.violations) === JSON.stringify(ce.p0_violated_rule_ids), "trace_summary.violations must match constraint_engine.p0_violated_rule_ids");

  console.log("PASS: weekly trace aggregates real constraint stats");
})();
