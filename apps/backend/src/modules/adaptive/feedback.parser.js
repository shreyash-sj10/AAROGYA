const { parseFeedback: parseFeedbackWithLLM } = require("../../services/ml/mlClient");

const VALID_TYPES = new Set(["LIKE", "DISLIKE", "REPLACE"]);

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeTarget(value) {
  return toSafeString(value).toLowerCase().replace(/[^a-z0-9_ -]/g, "").trim();
}

function sanitizeParsedFeedback(raw) {
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const feedbackTypeRaw = toSafeString(safeRaw.feedback_type).toUpperCase();
  const feedbackType = VALID_TYPES.has(feedbackTypeRaw) ? feedbackTypeRaw : "DISLIKE";
  const target = sanitizeTarget(safeRaw.target || "");

  return {
    feedback_type: feedbackType,
    target,
  };
}

function parseFeedbackSync(input) {
  const text = toSafeString(input).toLowerCase();

  if (text.includes("like") || text.includes("good") || text.includes("love")) {
    return { feedback_type: "LIKE", target: "" };
  }

  if (text.includes("replace") || text.includes("change") || text.includes("swap")) {
    return { feedback_type: "REPLACE", target: "" };
  }

  return { feedback_type: "DISLIKE", target: "" };
}

async function parseFeedback(input) {
  const safeInput = toSafeString(input);

  if (!safeInput) {
    return { feedback_type: "DISLIKE", target: "" };
  }

  const llmResult = await parseFeedbackWithLLM(safeInput);

  if (!llmResult || typeof llmResult !== "object") {
    return parseFeedbackSync(safeInput);
  }

  return sanitizeParsedFeedback(llmResult);
}

module.exports = {
  parseFeedback,
  parseFeedbackSync,
  sanitizeParsedFeedback,
};
