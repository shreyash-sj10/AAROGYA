const { getBestTemplate, extractCategories } = require("../../templates/mealTemplate.service");
const { generateCandidates } = require("../../modules/candidate/candidateGenerator");
const { applyConstraints } = require("../../modules/constraint/constraintEngine");
const { scoreCandidates } = require("../../modules/scoring/scoringEngine");
const { applyDiversity } = require("../../modules/diversity/diversityEngine");
const { buildGreedySolution } = require("../../modules/optimizer/optimizer.greedy");
const { runBeamSearch } = require("../../modules/optimizer/optimizer.beam");
const { sampleFoods } = require("../../modules/food/food.samples");
const sampleRules = require("../../rules/engine/rule.samples");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function cloneFood(food, suffix) {
  const safeFood = toSafeObject(food);
  return {
    ...safeFood,
    id: `${safeFood.id || "food"}_${suffix}`,
    name: `${safeFood.name || "food"}_${suffix}`,
  };
}

function buildScaledFoods(multiplier = 1, baseFoods = sampleFoods) {
  const safeBaseFoods = toSafeArray(baseFoods);
  const safeMultiplier = Math.max(1, Math.trunc(toSafeNumber(multiplier, 1)));
  const scaled = [];

  for (let i = 0; i < safeMultiplier; i += 1) {
    safeBaseFoods.forEach((food) => {
      scaled.push(cloneFood(food, i));
    });
  }

  return scaled;
}

function defaultUserState(mealType = "lunch") {
  return {
    user_id: "benchmark_user",
    goals: ["GOAL_MAINTENANCE"],
    risk_flags: [],
    symptoms: [],
    dosha_estimate: { vata: 0.34, pitta: 0.33, kapha: 0.33 },
    allergies: [],
    preferences: [],
    context: { meal_type: mealType, season: "summer" },
  };
}

function buildCandidatesByCategory(template, candidateMap) {
  const categories = extractCategories(template);
  const safeCandidateMap = toSafeObject(candidateMap);

  return categories.reduce((acc, category, index) => {
    acc[`${category}__${index}`] = toSafeArray(safeCandidateMap[category]);
    return acc;
  }, {});
}

function selectionSignature(solution) {
  const safe = toSafeObject(solution);
  const items = toSafeArray(safe.items);

  return items
    .map((item) => {
      const safeItem = toSafeObject(item);
      return String(safeItem.recipe_id || safeItem.id || safeItem.name || "").trim();
    })
    .filter(Boolean)
    .join("|");
}

function sumCandidateCount(candidateMap) {
  const safeMap = toSafeObject(candidateMap);
  return Object.keys(safeMap).reduce((sum, key) => sum + toSafeArray(safeMap[key]).length, 0);
}

function runActualPipelineStages({
  mealType = "lunch",
  foods = sampleFoods,
  rules = sampleRules,
  userState,
  userHistory = {},
  candidateTopK = 5,
  constraintTopK = 5,
} = {}) {
  const template = getBestTemplate(mealType);
  if (!template) {
    throw new Error(`No template found for meal type ${mealType}`);
  }

  const safeUserState = userState && typeof userState === "object" ? userState : defaultUserState(mealType);
  const generated = generateCandidates(template, toSafeArray(foods), safeUserState, toSafeArray(rules), { topK: candidateTopK });
  const constrained = applyConstraints(template, generated, safeUserState, toSafeArray(rules), { topK: constraintTopK });
  const scored = scoreCandidates(constrained, safeUserState, template);
  const diversified = applyDiversity(scored, toSafeObject(userHistory));

  return {
    template,
    generated,
    constrained,
    scored,
    diversified,
    candidatesByCategory: buildCandidatesByCategory(template, diversified),
    candidateCount: sumCandidateCount(diversified),
  };
}

function measureOptimizer(label, runner) {
  const startedAt = nowMs();
  const result = runner();
  const elapsedMs = Number((nowMs() - startedAt).toFixed(3));

  return {
    label,
    elapsed_ms: elapsedMs,
    result,
    selected_result: selectionSignature(result),
    total_score: Number(toSafeNumber(toSafeObject(result).totalScore, 0).toFixed(6)),
  };
}

function compareSelections(greedyMeasurement, beamMeasurement) {
  return {
    same_selection: greedyMeasurement.selected_result === beamMeasurement.selected_result,
    score_delta: Number((beamMeasurement.total_score - greedyMeasurement.total_score).toFixed(6)),
    greedy_score: greedyMeasurement.total_score,
    beam_score: beamMeasurement.total_score,
    greedy_selection: greedyMeasurement.selected_result,
    beam_selection: beamMeasurement.selected_result,
    beam_width: Math.max(1, Math.trunc(toSafeNumber(beamMeasurement.beam_width, 1))),
  };
}

function benchmarkOptimizers({
  mealType = "lunch",
  foods = sampleFoods,
  rules = sampleRules,
  userState,
  userHistory = {},
  candidateTopK = 5,
  constraintTopK = 5,
  beamWidth = 3,
} = {}) {
  const prepared = runActualPipelineStages({
    mealType,
    foods,
    rules,
    userState,
    userHistory,
    candidateTopK,
    constraintTopK,
  });

  const greedyMeasurement = measureOptimizer("greedy", () => buildGreedySolution(prepared.candidatesByCategory));
  const beamMeasurement = measureOptimizer(`beam_${beamWidth}`, () => runBeamSearch(prepared.candidatesByCategory, beamWidth));
  beamMeasurement.beam_width = Math.max(1, Math.trunc(toSafeNumber(beamWidth, 3)));

  return {
    candidates: prepared.candidateCount,
    greedy_time_ms: greedyMeasurement.elapsed_ms,
    beam_time_ms: beamMeasurement.elapsed_ms,
    result_difference: compareSelections(greedyMeasurement, beamMeasurement),
  };
}

function benchmarkAcrossBeamWidths(options = {}) {
  const safeBeamWidths = toSafeArray(options.beamWidths).length > 0 ? toSafeArray(options.beamWidths) : [3, 5];
  return safeBeamWidths.map((beamWidth) => benchmarkOptimizers({ ...options, beamWidth }));
}

module.exports = {
  benchmarkAcrossBeamWidths,
  benchmarkOptimizers,
  buildScaledFoods,
  prepareOptimizerInput: runActualPipelineStages,
  runActualPipelineStages,
};


