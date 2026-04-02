const { generateExplanation } = require("../explanation/explanationEngine");
const { getRAGExplanation } = require("../../services/ml/ragClient");
const { generateWeeklyPlan } = require("../planner/weeklyPlanner.service");
const { optimizeWeeklyPlan } = require("../planner/weeklyOptimizer.service");
const { validateDecisionResponse } = require("../../contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../../contracts/validators/validateTrace");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeInputText(input) {
  const safeInput = toSafeObject(input);
  return toSafeString(safeInput.userInput || safeInput.text || safeInput.query);
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildMealResultFromPlan(plan) {
  const safePlan = toSafeObject(plan);
  const mealPlan = toSafeArray(safePlan.meal_plan);

  return {
    meal: mealPlan.map((item) => toSafeString(toSafeObject(item).name || toSafeObject(item).recipe_id)).filter(Boolean),
    breakdown: {
      items: [],
      meta: {},
    },
  };
}

function resolveStartDate(input) {
  const safeInput = toSafeObject(input);
  const explicitDate = toSafeString(safeInput.startDate || safeInput.start_date);

  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildUserTargets(input, userState) {
  const safeInput = toSafeObject(input);
  const safeUserState = toSafeObject(userState);
  const explicitTargets = toSafeObject(safeInput.userTargets);

  return {
    daily_calories: Math.max(0, toSafeNumber(
      explicitTargets.daily_calories,
      toSafeNumber(safeInput.daily_calories, toSafeNumber(safeUserState.daily_calories, 0))
    )),
    protein_target: Math.max(0, toSafeNumber(
      explicitTargets.protein_target,
      toSafeNumber(safeInput.protein_target, toSafeNumber(safeUserState.protein_target, 0))
    )),
    carbs_target: Math.max(0, toSafeNumber(
      explicitTargets.carbs_target,
      toSafeNumber(safeInput.carbs_target, toSafeNumber(safeUserState.carbs_target, 0))
    )),
    fat_target: Math.max(0, toSafeNumber(
      explicitTargets.fat_target,
      toSafeNumber(safeInput.fat_target, toSafeNumber(safeUserState.fat_target, 0))
    )),
  };
}

function assertValidDecisionResponse(result, source) {
  const safe = toSafeObject(result);
  const responseValidation = validateDecisionResponse(safe);
  if (!responseValidation.valid) {
    throw new ContractViolationError("Handler DecisionResponse_v1 validation failed", {
      source,
      contract: "DecisionResponse_v1",
      errors: toSafeArray(responseValidation.errors),
    });
  }

  const traceValidation = validateTrace(safe.trace);
  if (!traceValidation.valid) {
    throw new ContractViolationError("Handler Trace_v1 validation failed", {
      source,
      contract: "Trace_v1",
      errors: toSafeArray(traceValidation.errors),
    });
  }

  return safe;
}

function normalizeCitations(value) {
  return toSafeArray(value)
    .map((citation) => {
      const safe = toSafeObject(citation);
      const text_id = toSafeString(safe.text_id || safe.id);
      const source = toSafeString(safe.source);
      const chapter = toSafeString(safe.chapter || "general");
      if (!text_id || !source || !chapter) {
        return null;
      }
      return { text_id, source, chapter };
    })
    .filter(Boolean);
}

async function handleGeneratePlan(input, context, deps) {
  const response = await deps.generatePlan(input);
  return assertValidDecisionResponse(response, "handlers.handleGeneratePlan");
}

async function handleGenerateWeeklyPlan(input, context, deps) {
  const safeInput = toSafeObject(input);
  const safeUserState = toSafeObject(safeInput.userState);

  const basePlan = await generateWeeklyPlan(safeUserState, resolveStartDate(safeInput), {
    days: safeInput.days,
    foods: toSafeArray(safeInput.foods),
    rules: toSafeArray(safeInput.rules),
    userHistory: toSafeObject(safeInput.userHistory),
    generatePlan: deps.generatePlan,
    weeklyState: {
      past_meals: [],
      category_counts: {},
      diversity_memory: [],
    },
  });

  const optimizationResult = optimizeWeeklyPlan({
    week_plan: toSafeArray(basePlan.meal_plan),
    meta: {
      total_calories: toSafeNumber(toSafeObject(basePlan.nutrition_summary).calories, 0),
      diversity_score: toSafeNumber(toSafeObject(toSafeObject(basePlan.confidence).components).diversity_impact, 1),
      confidence_avg: toSafeNumber(toSafeObject(basePlan.confidence).value, 0.3),
    },
  }, buildUserTargets(safeInput, safeUserState));

  const safeOptimization = toSafeObject(optimizationResult);
  const optimizedMealPlan = toSafeArray(toSafeObject(safeOptimization.optimized_week_plan).week_plan)
    .flatMap((day) => toSafeArray(toSafeObject(day).meals && Object.values(toSafeObject(day).meals)).flat());

  const result = {
    ...basePlan,
    meal_plan: optimizedMealPlan.length > 0 ? optimizedMealPlan : toSafeArray(basePlan.meal_plan),
    explanation: {
      deterministic: `${toSafeString(toSafeObject(basePlan.explanation).deterministic)} Weekly optimization applied.`,
      ai_explanation: toSafeString(toSafeObject(basePlan.explanation).ai_explanation),
      citations: normalizeCitations(toSafeObject(basePlan.explanation).citations),
    },
  };

  return assertValidDecisionResponse(result, "handlers.handleGenerateWeeklyPlan");
}

async function handleRefinePlan(input, context, deps) {
  const safeInput = toSafeObject(input);
  const safeContext = toSafeObject(context);
  const previousPlan = toSafeObject(safeContext.last_plan);

  const refinedInput = {
    ...safeInput,
    previous_plan: previousPlan,
  };

  const response = await deps.generatePlan(refinedInput);
  return assertValidDecisionResponse(response, "handlers.handleRefinePlan");
}

function handleExplain(input, context) {
  const safeContext = toSafeObject(context);
  const lastPlan = assertValidDecisionResponse(safeContext.last_plan, "handlers.handleExplain.input");

  const userState = toSafeObject(safeContext.user_state);
  const mealResult = buildMealResultFromPlan(lastPlan);
  const deterministic = generateExplanation(mealResult, userState);

  const response = {
    ...lastPlan,
    explanation: {
      deterministic: toSafeString(toSafeObject(deterministic).deterministic || toSafeObject(deterministic).explanation),
      ai_explanation: toSafeString(toSafeObject(deterministic).ai_explanation),
      citations: normalizeCitations(toSafeObject(deterministic).citations),
    },
  };

  return assertValidDecisionResponse(response, "handlers.handleExplain");
}

async function handleAlternative(input, context, deps) {
  const safeInput = toSafeObject(input);
  const mutated = {
    ...safeInput,
    trace_id: toSafeString(safeInput.trace_id || safeInput.traceId || "alt_trace") + "_alt",
  };

  const response = await deps.generatePlan(mutated);
  return assertValidDecisionResponse(response, "handlers.handleAlternative");
}

async function handleGeneralQuery(input, context) {
  const safeContext = toSafeObject(context);
  const lastPlan = assertValidDecisionResponse(safeContext.last_plan, "handlers.handleGeneralQuery.input");

  const query = toSafeInputText(input);
  const rag = await getRAGExplanation(query);
  const safeExplanation = toSafeObject(lastPlan.explanation);

  const response = {
    ...lastPlan,
    explanation: {
      deterministic: toSafeString(safeExplanation.deterministic),
      ai_explanation: rag && typeof rag.explanation === "string"
        ? rag.explanation
        : toSafeString(safeExplanation.ai_explanation),
      citations: rag && Array.isArray(rag.sources)
        ? normalizeCitations(rag.sources)
        : normalizeCitations(safeExplanation.citations),
    },
  };

  return assertValidDecisionResponse(response, "handlers.handleGeneralQuery");
}

function buildHandlers(deps) {
  return {
    handleGeneratePlan: (input, context) => handleGeneratePlan(input, context, deps),
    handleGenerateWeeklyPlan: (input, context) => handleGenerateWeeklyPlan(input, context, deps),
    handleRefinePlan: (input, context) => handleRefinePlan(input, context, deps),
    handleExplain: (input, context) => handleExplain(input, context, deps),
    handleAlternative: (input, context) => handleAlternative(input, context, deps),
    handleGeneralQuery: (input, context) => handleGeneralQuery(input, context, deps),
  };
}

module.exports = {
  buildHandlers,
};
