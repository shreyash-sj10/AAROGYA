"use strict";

/**
 * Phase 5 — recipe-first candidate path (synthetic per-food recipes + RecipeAggregate_v1 bridge).
 * Requires AAROGYA_RECIPE_FIRST_PIPELINE for the duration of this process.
 */
process.env.AAROGYA_RECIPE_FIRST_PIPELINE = "true";

const assert = require("assert");
const { generateCandidates } = require("../src/modules/candidate/candidateGenerator");
const { getBestTemplate } = require("../src/templates/mealTemplate.service");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");

const template = getBestTemplate("lunch");
const userState = {
  user_id: "recipe_first_ci",
  goals: ["maintenance"],
  conditions: ["diabetes"],
  diet: "vegetarian",
  risk_flags: [],
  allergies: [],
  preferences: [],
  context: { meal_type: "lunch", season: "summer", diet_type: "vegetarian" },
};

const foods = sampleFoods.filter((f) => ["dal", "vegetable"].includes(f.category)).slice(0, 16);

const candidates = generateCandidates(template, foods, userState, sampleRules, { topK: 8 });

assert.ok(candidates.dal && candidates.dal.length > 0, "recipe-first should yield dal candidates");
assert.ok(candidates.vegetable && candidates.vegetable.length > 0, "recipe-first should yield vegetable candidates");

const firstDal = candidates.dal[0];
assert.ok(firstDal && firstDal.recipe_aggregate, "candidate should carry RecipeAggregate_v1");
assert.strictEqual(firstDal.recipe_aggregate.version, "RecipeAggregate_v1");
assert.ok(
  firstDal.recipe_id && String(firstDal.recipe_id).startsWith("synth_"),
  "recipe_id should reference synthetic catalog recipe"
);

candidates.dal.forEach((row) => {
  assert.ok(row.nutrition && typeof row.nutrition.glycemic_index === "number", "bridged nutrition required");
});

const second = generateCandidates(template, foods, userState, sampleRules, { topK: 8 });
assert.deepStrictEqual(
  candidates.dal.map((c) => c.recipe_id),
  second.dal.map((c) => c.recipe_id),
  "recipe-first candidate ids must be deterministic"
);

console.log("PASS: Phase 5 recipe-first (synth recipes + aggregate bridge)");
