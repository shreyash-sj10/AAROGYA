"use strict";

/**
 * Phase 6 — optimizer caps, beam dedupe/prune, telemetry, greedy O(n) winner.
 */
const assert = require("assert");
const { runBeamSearch } = require("../src/modules/optimizer/optimizer.beam");
const { buildGreedySolution } = require("../src/modules/optimizer/optimizer.greedy");
const { getSnapshot, resetMetrics } = require("../src/observability/metrics");

function food(id, score) {
  return {
    id,
    recipe_id: id,
    name: id,
    finalScore: score,
    score,
    evaluation: { isValid: true, totalPenalty: 0, triggeredRules: [] },
    breakdown: {},
  };
}

function buildFatMap() {
  const dal = Array.from({ length: 48 }, (_, i) => food(`dal-${i}`, 0.99 - i * 0.0001));
  const veg = Array.from({ length: 48 }, (_, i) => food(`veg-${i}`, 0.98 - i * 0.0001));
  const grain = Array.from({ length: 48 }, (_, i) => food(`grain-${i}`, 0.97 - i * 0.0001));
  return {
    "dal__0": dal,
    "veg__0": veg,
    "grain__0": grain,
  };
}

resetMetrics();

const fat = buildFatMap();
const t0 = Date.now();
const beam = runBeamSearch(fat, 8, {
  maxBeamIntermediateStates: 120,
  maxCandidatesPerCategory: 36,
  maxBeamStates: 10,
});
const elapsed = Date.now() - t0;

assert.ok(beam && Array.isArray(beam.items) && beam.items.length === 3, "beam must select one item per category");
assert.ok(elapsed < 3000, `beam search should finish quickly (got ${elapsed}ms)`);

const greedy = buildGreedySolution(fat);
assert.ok(greedy && greedy.items.length === 3, "greedy must fill three categories");

const snap = getSnapshot();
assert.ok(snap.optimizer_search && snap.optimizer_search.beam_layer_expansions_total > 0, "metrics should record beam expansions");
assert.ok(snap.optimizer_search.beam_prune_events_total >= 1, "tight intermediate cap should trigger prune telemetry");

const beamB = runBeamSearch(fat, 8, {
  maxBeamIntermediateStates: 120,
  maxCandidatesPerCategory: 36,
  maxBeamStates: 10,
});
assert.deepStrictEqual(
  beam.items.map((x) => x.recipe_id),
  beamB.items.map((x) => x.recipe_id),
  "beam selection must be deterministic for identical inputs"
);

console.log("PASS: Phase 6 optimizer performance + telemetry");
