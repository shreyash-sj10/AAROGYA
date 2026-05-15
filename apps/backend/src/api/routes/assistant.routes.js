const { detectUncertainty, selectNextQuestion } = require("../../modules/refinement/refinementEngine");
const { toSafeObject, toSafeString } = require("../../utils/safeUtils");
const { handleUserQuery } = require("../../core/assistant/handleUserQuery");

function hasRequiredExplainContext(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function registerAssistantRoutes(app) {
  if (!app || typeof app.post !== "function") {
    throw new Error("registerAssistantRoutes requires an app with post(path, ...handlers)");
  }

  const handleOrchestration = async (req, res) => {
    try {
      const body = toSafeObject(req && req.body);
      const query = toSafeString(body.user_input || body.query || body.text);
      const rawContext = toSafeObject(body.context);
      const sessionId = toSafeString(body.session_id || rawContext.session_id);

      const result = await handleUserQuery(query, {
        ...rawContext,
        session_id: sessionId,
      });

      return res.status(200).json({
        intent: toSafeString(result.intent || "KNOWLEDGE_QUERY"),
        routed_endpoint: toSafeString(result.routed_endpoint || "/ai/rag"),
        text: toSafeString(result.text),
        message: toSafeString(result.text),
        session_id: toSafeString(result.session_id || sessionId),
        meta: toSafeObject(result.meta),
      });
    } catch (_error) {
      return res.status(200).json({
        intent: "KNOWLEDGE_QUERY",
        routed_endpoint: "/ai/rag",
        text: "Can you clarify your question?",
        message: "Can you clarify your question?",
        session_id: toSafeString(toSafeObject(req && req.body).session_id),
        meta: {
          fallback: true,
          reason: "no_context",
          mode: "fallback",
        },
      });
    }
  };

  app.post("/assistant/orchestrate", handleOrchestration);
  app.post("/assistant/query", handleOrchestration);

  app.post("/ai/explain", async (req, res) => {
    try {
      const body = toSafeObject(req && req.body);
      const rawContext = toSafeObject(body.context);
      const sessionId = toSafeString(body.session_id || rawContext.session_id);
      const selectedMeal = toSafeObject(body.selected_meal || rawContext.selected_meal || toSafeObject(rawContext.current_plan).selected_meal);
      const constraintsApplied = toSafeObject(body.constraints_applied || rawContext.constraints_applied || toSafeObject(rawContext.current_plan).constraints_applied);
      const decisionTrace = toSafeObject(
        body.decision_trace
        || body.trace
        || rawContext.decision_trace
        || rawContext.trace
        || toSafeObject(rawContext.current_plan).decision_trace
        || toSafeObject(rawContext.current_plan).trace
      );
      const query = toSafeString(body.query || body.user_input || "Explain the planner decision");

      const hasExplainContext = Boolean(
        sessionId
        && hasRequiredExplainContext(selectedMeal)
        && hasRequiredExplainContext(constraintsApplied)
        && hasRequiredExplainContext(decisionTrace)
      );

      if (!hasExplainContext) {
        return res.status(400).json({
          success: false,
          error: "INSUFFICIENT_CONTEXT",
        });
      }

      const result = await handleUserQuery(query, {
        session_id: sessionId,
        force_explain: true,
        decision_trace: decisionTrace,
        trace: decisionTrace,
        selected_meal: selectedMeal,
        constraints_applied: constraintsApplied,
        current_plan: {
          selected_meal: selectedMeal,
          constraints_applied: constraintsApplied,
          decision_trace: decisionTrace,
          trace: decisionTrace,
        },
      });

      return res.status(200).json({
        text: toSafeString(result.text),
        session_id: toSafeString(result.session_id || sessionId),
        meta: toSafeObject(result.meta),
      });
    } catch (_error) {
      return res.status(200).json({
        text: "Can you clarify your question?",
        meta: {
          fallback: true,
          reason: "no_context",
          mode: "fallback",
        },
      });
    }
  });

  app.post("/next-question", async (req, res) => {
    try {
      const body = toSafeObject(req.body);
      const signals = detectUncertainty(body.request, body.response);
      const question = selectNextQuestion(signals);

      return res.status(200).json({
        request_id: `refine_${Date.now()}`,
        signals,
        question: question ? {
          id: question.id,
          type: question.type || "single_choice",
          text: question.text || "...",
          options: question.options || [],
        } : null,
      });
    } catch (error) {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Refinement check failed",
      });
    }
  });
}

module.exports = {
  registerAssistantRoutes,
};
