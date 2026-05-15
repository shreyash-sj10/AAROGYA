const { validateRuleSetOrThrow } = require("../src/rules/engine/constraintEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(function runRuleSchemaAlignmentTest() {
  const invalidRules = [
    {
      id: "invalid_operator_rule",
      priority: "P0",
      logic_tree: {
        logic: "AND",
        conditions: [
          { entity: "user.allergies", operator: "intersects", value: "peanut" },
        ],
      },
      action: { type: "reject", message_template: "invalid" },
    },
  ];

  let threw = false;
  try {
    validateRuleSetOrThrow(invalidRules, { label: "invalid_rules", requireP0: true });
  } catch (error) {
    threw = true;
    assert(String(error.message).includes("Invalid rule operator"), "Expected unsupported operator validation error");
  }

  assert(threw, "Expected invalid operator to fail validation");
  console.log("PASS: invalid rules are rejected by strict rule schema validation");
})();
