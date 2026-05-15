/**
 * testConfidenceModel.js
 * 
 * Verification of the multi-factor deterministic confidence model.
 * 
 * Tests:
 *   1. STRICT CASE (L0) — high confidence expected
 *   2. RELAXED CASE — confidence decreases with relaxation
 *   3. LOW POOL CASE — confidence decreases with few candidates
 *   4. CLOSE SCORES — confidence decreases with small margin
 *   5. TRACE CHECK — all components present
 *   6. DETERMINISM — same input → same output
 */

// Inline the function directly to test in isolation
function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toSafeNumber(value, 0)));
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function computeDynamicConfidence(mealResult, optimizerStats, relaxationLevel) {
  const safeStats = toSafeObject(optimizerStats);
  const safeBreakdown = toSafeObject(toSafeObject(mealResult).breakdown);
  const safeMeta = toSafeObject(safeBreakdown.meta);

  const baseScore = clamp01(toSafeNumber(toSafeObject(mealResult).score, 0));
  const topScore = clamp01(toSafeNumber(safeStats.selectedScore, baseScore));
  const secondBestScore = clamp01(toSafeNumber(safeStats.secondBestScore, topScore));
  const poolSize = Math.max(0, toSafeNumber(safeStats.inputCount, 0));

  const relaxationImpacts = { 0: 1.0, 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.1 };
  const relaxation_impact = relaxationImpacts[relaxationLevel] || 0.1;

  let pool_quality = 1.0;
  if (poolSize <= 3) pool_quality = 0.5;
  else if (poolSize <= 10) pool_quality = 0.8;

  const scoreMargin = Math.max(0, topScore - secondBestScore);
  let score_confidence = 1.0;
  if (poolSize <= 1) {
    score_confidence = 0.5;
  } else if (scoreMargin <= 0.01) {
    score_confidence = 0.6;
  } else if (scoreMargin <= 0.05) {
    score_confidence = 0.8;
  }

  const totalPenalty = clamp01(toSafeNumber(safeMeta.totalPenalty, 0));
  const penalty_impact = Math.max(0, 1.0 - (totalPenalty * 2));

  const divPenalty = clamp01(toSafeNumber(safeMeta.totalDiversityPenalty, 0));
  const diversity_impact = Math.max(0, 1.0 - (divPenalty * 2));

  const rawConfidence = baseScore * relaxation_impact * pool_quality * score_confidence * penalty_impact * diversity_impact;

  return {
    value: clamp01(Number(rawConfidence.toFixed(6))),
    components: {
      relaxation_impact,
      pool_quality,
      score_confidence,
      penalty_impact,
      diversity_impact
    }
  };
}

function getLevel(value) {
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────
// TEST 1: STRICT CASE (L0)
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 1: STRICT CASE (L0)");
{
  const result = computeDynamicConfidence(
    { score: 0.85, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.85, secondBestScore: 0.60, inputCount: 25 },
    0
  );
  assert(result.value >= 0.75, `value=${result.value} → HIGH (≥ 0.75)`);
  assert(getLevel(result.value) === "high", `level=${getLevel(result.value)}`);
  assert(result.components.relaxation_impact === 1.0, `relaxation_impact=1.0`);
  assert(result.components.pool_quality === 1.0, `pool_quality=1.0 (pool=25)`);
  assert(result.components.score_confidence === 1.0, `score_confidence=1.0 (margin=0.25)`);
}

// ─────────────────────────────────────────────────────────
// TEST 2: RELAXED CASE
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 2: RELAXED CASE");
{
  const strictResult = computeDynamicConfidence(
    { score: 0.85, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.85, secondBestScore: 0.60, inputCount: 25 },
    0
  );
  const relaxedL1 = computeDynamicConfidence(
    { score: 0.85, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.85, secondBestScore: 0.60, inputCount: 25 },
    1
  );
  const relaxedL2 = computeDynamicConfidence(
    { score: 0.85, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.85, secondBestScore: 0.60, inputCount: 25 },
    2
  );
  assert(relaxedL1.value < strictResult.value, `L1(${relaxedL1.value}) < L0(${strictResult.value})`);
  assert(relaxedL2.value < relaxedL1.value, `L2(${relaxedL2.value}) < L1(${relaxedL1.value})`);
  assert(relaxedL1.components.relaxation_impact === 0.8, `L1 relaxation_impact=0.8`);
  assert(relaxedL2.components.relaxation_impact === 0.6, `L2 relaxation_impact=0.6`);
}

// ─────────────────────────────────────────────────────────
// TEST 3: LOW POOL CASE
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 3: LOW POOL CASE");
{
  const largePool = computeDynamicConfidence(
    { score: 0.80, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.80, secondBestScore: 0.60, inputCount: 20 },
    0
  );
  const smallPool = computeDynamicConfidence(
    { score: 0.80, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.80, secondBestScore: 0.60, inputCount: 2 },
    0
  );
  assert(smallPool.value < largePool.value, `smallPool(${smallPool.value}) < largePool(${largePool.value})`);
  assert(smallPool.components.pool_quality === 0.5, `pool_quality=0.5 (pool=2)`);
  assert(largePool.components.pool_quality === 1.0, `pool_quality=1.0 (pool=20)`);
}

// ─────────────────────────────────────────────────────────
// TEST 4: CLOSE SCORES
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 4: CLOSE SCORES");
{
  const wideMargin = computeDynamicConfidence(
    { score: 0.80, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.80, secondBestScore: 0.50, inputCount: 20 },
    0
  );
  const tightMargin = computeDynamicConfidence(
    { score: 0.80, breakdown: { meta: { totalPenalty: 0, totalDiversityPenalty: 0 } } },
    { selectedScore: 0.80, secondBestScore: 0.795, inputCount: 20 },
    0
  );
  assert(tightMargin.value < wideMargin.value, `tightMargin(${tightMargin.value}) < wideMargin(${wideMargin.value})`);
  assert(tightMargin.components.score_confidence === 0.6, `score_confidence=0.6 (margin=0.005)`);
  assert(wideMargin.components.score_confidence === 1.0, `score_confidence=1.0 (margin=0.30)`);
}

// ─────────────────────────────────────────────────────────
// TEST 5: TRACE CHECK — all components present
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 5: TRACE CHECK");
{
  const result = computeDynamicConfidence(
    { score: 0.70, breakdown: { meta: { totalPenalty: 0.1, totalDiversityPenalty: 0.05 } } },
    { selectedScore: 0.70, secondBestScore: 0.65, inputCount: 8 },
    1
  );
  const c = result.components;
  assert(typeof result.value === "number", `value is number`);
  assert(result.value >= 0 && result.value <= 1, `value ∈ [0,1]: ${result.value}`);
  assert(typeof c.relaxation_impact === "number", `relaxation_impact is number`);
  assert(typeof c.pool_quality === "number", `pool_quality is number`);
  assert(typeof c.score_confidence === "number", `score_confidence is number`);
  assert(typeof c.penalty_impact === "number", `penalty_impact is number`);
  assert(typeof c.diversity_impact === "number", `diversity_impact is number`);

  console.log(`\n  📊 Trace sample:`);
  console.log(`     value: ${result.value}`);
  console.log(`     level: ${getLevel(result.value)}`);
  console.log(`     components:`, JSON.stringify(c, null, 6));
}

// ─────────────────────────────────────────────────────────
// TEST 6: DETERMINISM — same input → same output
// ─────────────────────────────────────────────────────────
console.log("\n🔍 TEST 6: DETERMINISM");
{
  const input = {
    meal: { score: 0.75, breakdown: { meta: { totalPenalty: 0.05, totalDiversityPenalty: 0.02 } } },
    stats: { selectedScore: 0.75, secondBestScore: 0.70, inputCount: 12 },
    level: 0,
  };
  const r1 = computeDynamicConfidence(input.meal, input.stats, input.level);
  const r2 = computeDynamicConfidence(input.meal, input.stats, input.level);
  const r3 = computeDynamicConfidence(input.meal, input.stats, input.level);
  assert(r1.value === r2.value && r2.value === r3.value, `3 runs identical: ${r1.value} === ${r2.value} === ${r3.value}`);
  assert(JSON.stringify(r1.components) === JSON.stringify(r2.components), `component objects identical`);
}

// ─────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`  PASSED: ${passed}  |  FAILED: ${failed}`);
console.log(`  RESULT: ${failed === 0 ? "✅ PASS" : "❌ FAIL"}`);
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
