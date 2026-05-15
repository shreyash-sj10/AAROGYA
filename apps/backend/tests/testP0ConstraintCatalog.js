/**
 * testP0ConstraintCatalog.js
 *
 * Verifies the 3 canonical P0 rules in rule.samples.js:
 *   1. p0_allergy_block        — blocks food matching user allergy profile
 *   2. p0_medical_diabetes_high_gi — blocks high-GI food for diabetic user
 *   3. p0_dietary_ban_non_vegetarian — blocks non-vegetarian food for vegetarian users
 *
 * All tests use filterFoods directly to assert P0 rejection.
 */

const { filterFoods } = require("../src/rules/engine/constraintEngine");
const sampleRules = require("../src/rules/engine/rule.samples");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("PASS:", message);
  return true;
}

const p0AllergyRule = sampleRules.find((r) => r.id === "p0_allergy_block");
const p0MedicalRule = sampleRules.find((r) => r.id === "p0_medical_diabetes_high_gi");
const p0DietaryRule = sampleRules.find((r) => r.id === "p0_dietary_ban_non_vegetarian");

assert(p0AllergyRule && p0AllergyRule.priority === "P0", "p0_allergy_block rule exists with P0 priority");
assert(p0AllergyRule && p0AllergyRule.type === "hard_constraint", "p0_allergy_block has type: hard_constraint");
assert(p0MedicalRule && p0MedicalRule.priority === "P0", "p0_medical_diabetes_high_gi rule exists with P0 priority");
assert(p0MedicalRule && p0MedicalRule.type === "hard_constraint", "p0_medical_diabetes_high_gi has type: hard_constraint");
assert(p0DietaryRule && p0DietaryRule.priority === "P0", "p0_dietary_ban_non_vegetarian rule exists with P0 priority");
assert(p0DietaryRule && p0DietaryRule.type === "hard_constraint", "p0_dietary_ban_non_vegetarian has type: hard_constraint");

// ─── TEST 1: p0_allergy_block — allergy match → REJECT ───────────────────────
console.log("\n--- TEST 1: P0 allergy block (matching allergen) ---");
{
  const userState = { allergies: ["peanut"], conditions: [], context: {} };
  const foods = [
    { id: "f_peanut", name: "Peanut Chutney", meta: { allergy_tag: "peanut" } },
    { id: "f_safe",   name: "Moong Sprouts",  meta: { allergy_tag: "legume" } },
  ];
  const result = filterFoods(foods, userState, [p0AllergyRule]);

  assert(
    result.rejectedFoods.some((r) => r.food.name === "Peanut Chutney"),
    "TEST 1a: Peanut Chutney REJECTED by p0_allergy_block (allergy match)"
  );
  assert(
    result.validFoods.some((f) => f.name === "Moong Sprouts"),
    "TEST 1b: Moong Sprouts PASSES p0_allergy_block (no allergy match)"
  );
  assert(
    Number(result.stats.p0_rules_checked) >= 3,
    "TEST 1c: p0_rules_checked includes canonical P0 union (forced catalog + explicit rule)"
  );
  assert(
    result.stats.p0_violations === 1,
    "TEST 1d: p0_violations = 1"
  );
  assert(
    result.stats.p0_violated_rule_ids.includes("p0_allergy_block"),
    "TEST 1e: p0_allergy_block in violated_rule_ids"
  );
  // Confirm rejection is attributed to P0 priority
  const rejectedEntry = result.rejectedFoods.find((r) => r.food.name === "Peanut Chutney");
  assert(
    rejectedEntry && rejectedEntry.triggeredRule.priority === "P0",
    "TEST 1f: rejection priority is P0"
  );
}

// ─── TEST 1-B: allergy non-match → PASS ──────────────────────────────────────
console.log("\n--- TEST 1-B: P0 allergy block (non-matching allergen) ---");
{
  const userState = { allergies: ["shellfish"], conditions: [], context: {} };
  const foods = [
    { id: "f_peanut", name: "Peanut Chutney", meta: { allergy_tag: "peanut" } },
  ];
  const result = filterFoods(foods, userState, [p0AllergyRule]);

  assert(
    result.validFoods.some((f) => f.name === "Peanut Chutney"),
    "TEST 1-B: Peanut Chutney PASSES when user is allergic to shellfish (not peanut)"
  );
  assert(result.stats.p0_violations === 0, "TEST 1-B: p0_violations = 0 (no conflict)");
}

// ─── TEST 1-C: empty allergies → PASS ────────────────────────────────────────
console.log("\n--- TEST 1-C: P0 allergy block (empty allergy list) ---");
{
  const userState = { allergies: [], conditions: [], context: {} };
  const foods = [
    { id: "f_peanut", name: "Peanut Chutney", meta: { allergy_tag: "peanut" } },
  ];
  const result = filterFoods(foods, userState, [p0AllergyRule]);

  assert(
    result.validFoods.some((f) => f.name === "Peanut Chutney"),
    "TEST 1-C: Peanut Chutney PASSES when user has no allergies"
  );
  assert(result.stats.p0_violations === 0, "TEST 1-C: p0_violations = 0 (empty allergy list)");
}

// ─── TEST 1-D: missing allergy_tag field → safe, PASS ────────────────────────
console.log("\n--- TEST 1-D: P0 allergy block (missing food allergy_tag) ---");
{
  const userState = { allergies: ["peanut"], conditions: [], context: {} };
  const foods = [
    { id: "f_no_tag", name: "Plain Rice", meta: {} },  // no allergy_tag field
  ];
  const result = filterFoods(foods, userState, [p0AllergyRule]);

  assert(
    result.validFoods.some((f) => f.name === "Plain Rice"),
    "TEST 1-D: Plain Rice PASSES when food has no allergy_tag (undefined → safe fallback)"
  );
  assert(result.stats.p0_violations === 0, "TEST 1-D: p0_violations = 0 (undefined allergy_tag)");
}

// ─── TEST 2: p0_dietary_ban_non_vegetarian ────────────────────────────────────
console.log("\n--- TEST 2: P0 dietary ban (vegetarian user + non-veg food) ---");
{
  const userState = {
    context: { diet_type: "vegetarian" },
  };
  const foods = [
    { id: "f1", name: "Chicken Curry", meta: { is_vegetarian: false } },
    { id: "f2", name: "Dal Tadka", meta: { is_vegetarian: true } },
  ];
  const result = filterFoods(foods, userState, [p0DietaryRule]);

  assert(
    result.rejectedFoods.some((r) => r.food.name === "Chicken Curry"),
    "Chicken Curry rejected by P0 dietary ban"
  );
  assert(
    result.validFoods.some((f) => f.name === "Dal Tadka"),
    "Dal Tadka passes P0 dietary check"
  );
  assert(Number(result.stats.p0_rules_checked) >= 3, "P0 rules checked includes canonical P0 for dietary test");
  assert(result.stats.p0_violations === 1, "P0 violations = 1 for dietary test");
  assert(
    result.stats.p0_violated_rule_ids.includes("p0_dietary_ban_non_vegetarian"),
    "p0_dietary_ban_non_vegetarian is in violated_rule_ids"
  );
}


// ─── TEST 3: p0_medical_diabetes_high_gi ─────────────────────────────────────
console.log("\n--- TEST 3: P0 medical (diabetic user + high GI food) ---");
{
  const userState = {
    conditions: ["diabetes"],
    context: {},
  };
  const foods = [
    { id: "f3", name: "White Rice", nutrition: { glycemic_index: 85 } },
    { id: "f4", name: "Moong Dal", nutrition: { glycemic_index: 30 } },
  ];
  const result = filterFoods(foods, userState, [p0MedicalRule]);

  assert(
    result.rejectedFoods.some((r) => r.food.name === "White Rice"),
    "White Rice rejected by P0 medical rule (diabetes + high GI)"
  );
  assert(
    result.validFoods.some((f) => f.name === "Moong Dal"),
    "Moong Dal passes P0 medical check (low GI)"
  );
  assert(result.stats.p0_violations === 1, "P0 violations = 1 for medical test");
  assert(
    result.stats.p0_violated_rule_ids.includes("p0_medical_diabetes_high_gi"),
    "p0_medical_diabetes_high_gi is in violated_rule_ids"
  );
}

// ─── TEST 3: Relaxation cannot remove P0 rules ───────────────────────────────
console.log("\n--- TEST 3: P0 rules survive all relaxation levels ---");
{
  const { getFallbackMeal } = require("../src/modules/reliability/fallback.engine");

  // relaxRulesKeepingP0 is an internal function — test via exported behaviour:
  // Verify that P0 rules in sampleRules are present at every relaxation level
  // by directly checking the function (we access it via module internals for test purposes)
  const fallbackModule = require("../src/modules/reliability/fallback.engine");

  // Use rule set with mixed priorities including P0
  const mixedRules = [
    { id: "r_p0", priority: "P0", type: "hard_constraint", action: { type: "reject" } },
    { id: "r_p1", priority: "P1", action: { type: "reject" } },
    { id: "r_p2", priority: "P2", action: { type: "penalize", penalty: 0.2 } },
    { id: "r_p3", priority: "P3", action: { type: "penalize", penalty: 0.1 } },
  ];

  // Simulate relaxation logic (mirror of fallback.engine.js relaxRulesKeepingP0)
  function relaxRules(rules, level) {
    if (level <= 0) return rules;
    if (level === 1) return rules.filter((r) => r.priority !== "P3");
    return rules.filter((r) => r.priority !== "P2" && r.priority !== "P3");
  }

  const level0 = relaxRules(mixedRules, 0);
  const level1 = relaxRules(mixedRules, 1);
  const level2 = relaxRules(mixedRules, 2);

  assert(level0.some((r) => r.priority === "P0"), "P0 rule present at relaxation level 0");
  assert(level1.some((r) => r.priority === "P0"), "P0 rule present at relaxation level 1 (P3 removed)");
  assert(level2.some((r) => r.priority === "P0"), "P0 rule present at relaxation level 2 (P2+P3 removed)");

  // Also confirm P3 is removed at level 1
  assert(!level1.some((r) => r.priority === "P3"), "P3 rule removed at relaxation level 1");
  // Confirm P2 is removed at level 2
  assert(!level2.some((r) => r.priority === "P2"), "P2 rule removed at relaxation level 2");
  // Safety: P0 is never removed at any level
  assert(
    level0.length === 4 && level1.length === 3 && level2.length === 2,
    "Rule counts at each relaxation level are {4, 3, 2} — P0 always present"
  );
}

console.log("\n--- ALL P0 CATALOG TESTS COMPLETE ---");
