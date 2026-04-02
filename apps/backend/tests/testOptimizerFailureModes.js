const { prepareOptimizerInput } = require("../src/utils/benchmark/optimizerBenchmark");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function scoreOf(item) {
  const safe = toSafeObject(item);
  if (typeof safe.finalScore === "number" && Number.isFinite(safe.finalScore)) {
    return safe.finalScore;
  }
  if (typeof safe.score === "number" && Number.isFinite(safe.score)) {
    return safe.score;
  }
  return 0;
}

function itemId(item) {
  const safe = toSafeObject(item);
  return String(safe.recipe_id || safe.id || safe.name || "");
}

function pairKey(left, right) {
  return `${left}|${right}`;
}

function isCompatible(items, nextItem, incompatibilities) {
  const nextId = itemId(nextItem);
  for (const selected of items) {
    const selectedId = itemId(selected);
    if (incompatibilities.has(pairKey(selectedId, nextId)) || incompatibilities.has(pairKey(nextId, selectedId))) {
      return false;
    }
  }
  return true;
}

function greedyNaive(categoriesMap) {
  const keys = Object.keys(categoriesMap).sort((a, b) => a.localeCompare(b));
  const items = keys.map((key) => toSafeArray(categoriesMap[key])[0]).filter(Boolean);
  const score = Number(items.reduce((sum, item) => sum + scoreOf(item), 0).toFixed(6));
  return { items, score };
}

function beamWithCompatibility(categoriesMap, beamWidth, incompatibilities) {
  const keys = Object.keys(categoriesMap).sort((a, b) => a.localeCompare(b));
  let beam = [{ items: [], score: 0 }];

  keys.forEach((key) => {
    const candidates = toSafeArray(categoriesMap[key]);
    const nextBeam = [];

    beam.forEach((state) => {
      candidates.forEach((candidate) => {
        if (!isCompatible(state.items, candidate, incompatibilities)) {
          return;
        }

        nextBeam.push({
          items: [...state.items, candidate],
          score: Number((state.score + scoreOf(candidate)).toFixed(6)),
        });
      });
    });

    nextBeam.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftKey = left.items.map((item) => itemId(item)).join("|");
      const rightKey = right.items.map((item) => itemId(item)).join("|");
      return leftKey.localeCompare(rightKey);
    });

    beam = nextBeam.slice(0, Math.max(1, beamWidth));
  });

  return beam[0] || { items: [], score: 0 };
}

(function runFailureModeAnalysis() {
  const prepared = prepareOptimizerInput({
    mealType: "lunch",
    candidateTopK: 10,
    constraintTopK: 10,
  });

  const categories = Object.keys(prepared.candidatesByCategory).sort((a, b) => a.localeCompare(b));
  assert(categories.length >= 2, "expected at least two optimizer slots for failure mode analysis");

  const greedy = greedyNaive(prepared.candidatesByCategory);
  const greedyIds = greedy.items.map((item) => itemId(item));
  assert(greedyIds.length === categories.length, "expected greedy to fill every slot");

  const incompatibilities = new Set([
    pairKey(greedyIds[0], greedyIds[1]),
    pairKey(greedyIds[1], greedyIds[0]),
  ]);

  const greedyInvalid = !isCompatible([greedy.items[0]], greedy.items[1], incompatibilities);
  assert(greedyInvalid, "expected greedy top-pair to be incompatible in constructed case");

  const beam = beamWithCompatibility(prepared.candidatesByCategory, 5, incompatibilities);
  assert(beam.items.length === categories.length, "beam should produce a complete compatible selection");
  assert(beam.score > 0, "beam score should be positive");

  const greedyEffectiveScore = 0;
  const scoreDifference = Number((beam.score - greedyEffectiveScore).toFixed(6));

  assert(scoreDifference > 0, "beam must outperform greedy in compatibility failure mode");

  console.log(`[optimizer-failure] greedy_effective_score=${greedyEffectiveScore} beam_score=${beam.score} score_diff=${scoreDifference}`);
  console.log("[optimizer-failure] reasoning=greedy selected independent per-slot winners that become invalid together; beam retained alternative partial states and found a better compatible bundle");
  console.log("PASS: optimizer failure-mode analysis captured a deterministic greedy suboptimal case and beam recovery");
})();

