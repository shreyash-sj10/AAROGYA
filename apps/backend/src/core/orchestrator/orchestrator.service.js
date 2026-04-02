const { classifyIntent } = require("./intent.classifier");
const { routeIntent } = require("./router");
const { getContext, updateContext } = require("./context.manager");
const { validateDecisionResponse } = require("../../contracts/validators/validateDecisionResponse");
const { validateTrace } = require("../../contracts/validators/validateTrace");
const { ContractViolationError } = require("../../contracts/errors/ContractViolationError");
const { processFeedback, processFeedbackAsync } = require("../adaptive/feedback.service");
const FEATURE_FLAGS = require("../../config/featureFlags");
const { logError } = require("../../observability/logger");
const { recordError } = require("../../observability/metrics");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validateContractOutput(result, intent) {
  const responseValidation = validateDecisionResponse(result);
  const traceValidation = validateTrace(toSafeObject(result).trace);

  if (!responseValidation.valid || !traceValidation.valid) {
    throw new ContractViolationError("Invalid orchestrator handler output", {
      source: "orchestrator.service",
      intent,
      response_errors: responseValidation.errors || [],
      trace_errors: traceValidation.errors || [],
    });
  }
}

function reportAdaptiveError(message, err) {
  const errMessage = err instanceof Error ? err.message : String(err || "unknown");
  logError({
    error_type: "SYSTEM_ERROR",
    message: `${message}: ${errMessage}`,
  });
  recordError("SYSTEM_ERROR");
}

async function handleUserInput(input, user_id, options = {}) {
  const safeInput = toSafeObject(input);
  const userId = toSafeString(user_id, "anonymous");
  const handlers = toSafeObject(options.handlers);
  const context = getContext(userId);
  const text = toSafeString(safeInput.userInput || safeInput.text || safeInput.query, "");
  const hasMealType = typeof safeInput.mealType === "string" && safeInput.mealType.trim();
  const intent = hasMealType ? "GENERATE_PLAN" : (text ? classifyIntent(text) : "GENERAL_QUERY");
  const route = routeIntent(intent, context);
  const handler = handlers[route.handler] || handlers.handleGeneralQuery;

  if (typeof handler !== "function") {
    throw new ContractViolationError("No handler available for intent route", {
      source: "orchestrator.service",
      intent,
      route,
    });
  }

  const result = await handler(safeInput, context);
  validateContractOutput(result, intent);

  await updateContext(userId, {
    last_plan: result,
    user_state: safeInput.userState,
    last_intent: intent,
  });

  if (
    FEATURE_FLAGS.useAdaptiveScoring
    && typeof safeInput.feedback === "string"
    && safeInput.feedback.trim()
  ) {
    Promise.resolve(processFeedbackAsync(userId, safeInput.feedback, safeInput.meal || result))
      .catch((err) => {
        reportAdaptiveError("Adaptive feedback async processing failed", err);

        try {
          processFeedback(userId, safeInput.feedback, safeInput.meal || result);
        } catch (fallbackErr) {
          reportAdaptiveError("Adaptive feedback fallback processing failed", fallbackErr);
        }
      });
  }

  return result;
}

module.exports = {
  handleUserInput,
};
