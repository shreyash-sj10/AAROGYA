function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const canonicalPath = require.resolve("../src/rules/definitions/canonicalRules", { paths: [__dirname] });
const constraintPath = require.resolve("../src/rules/engine/constraintEngine", { paths: [__dirname] });

const originalCanonical = require.cache[canonicalPath];
const originalConstraint = require.cache[constraintPath];

try {
  require.cache[canonicalPath] = {
    id: canonicalPath,
    filename: canonicalPath,
    loaded: true,
    exports: {
      getCanonicalP0Rules: () => ([
        {
          id: "BROKEN_P0_RULE",
          priority: "P0",
          logic_tree: {
            logic: "AND",
            conditions: [
              { entity: "user.allergies", operator: "intersects", value: "peanut" },
            ],
          },
          action: { type: "reject", message_template: "invalid" },
        },
      ]),
    },
  };

  delete require.cache[constraintPath];

  let threw = false;
  try {
    require(constraintPath);
  } catch (error) {
    threw = true;
    assert(String(error.message).includes("Invalid rule operator"), "Expected startup crash on invalid canonical operator");
  }

  assert(threw, "Expected constraint engine load to fail with invalid canonical rules");
  console.log("PASS: startup fails when canonical rule set is invalid");
} finally {
  delete require.cache[constraintPath];
  delete require.cache[canonicalPath];

  if (originalCanonical) {
    require.cache[canonicalPath] = originalCanonical;
  }
  if (originalConstraint) {
    require.cache[constraintPath] = originalConstraint;
  }
}
