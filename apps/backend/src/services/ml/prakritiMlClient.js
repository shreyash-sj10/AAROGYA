const Ajv = require("ajv");
const { callML } = require("./mlClient");

const PRAKRITI_ML_ENDPOINT = process.env.AYUDIET_ML_PRAKRITI_ENDPOINT || "prakriti";
const USE_ML = String(process.env.USE_ML || "true").trim().toLowerCase() === "true";

const requestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "object",
      additionalProperties: false,
      required: [
        "body_build",
        "skin",
        "appetite",
        "energy",
        "nature",
        "sleep",
        "climate",
        "food_response",
        "work_style",
        "weight",
      ],
      properties: {
        body_build: { type: "string", enum: ["thin", "medium", "heavy"] },
        skin: { type: "string", enum: ["dry", "warm_oily", "thick_cool"] },
        appetite: { type: "string", enum: ["irregular", "strong", "slow"] },
        energy: { type: "string", enum: ["variable", "intense", "stable"] },
        nature: { type: "string", enum: ["anxious", "irritable", "calm"] },
        sleep: { type: "string", enum: ["light", "moderate", "deep"] },
        climate: { type: "string", enum: ["warm", "cool", "dry"] },
        food_response: { type: "string", enum: ["bloated", "acidic", "sluggish"] },
        work_style: { type: "string", enum: ["inconsistent", "intense", "steady"] },
        weight: { type: "string", enum: ["lose", "stable", "gain"] },
      },
    },
    symptoms: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["vata", "pitta", "kapha"],
  properties: {
    vata: { type: "number", minimum: 0, maximum: 1 },
    pitta: { type: "number", minimum: 0, maximum: 1 },
    kapha: { type: "number", minimum: 0, maximum: 1 },
  },
};

const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: false });
const validateRequest = ajv.compile(requestSchema);
const validateResponse = ajv.compile(responseSchema);

function formatAjvErrors(errors) {
  return Array.isArray(errors)
    ? errors.map((entry) => ({
      instancePath: entry.instancePath || "",
      schemaPath: entry.schemaPath || "",
      keyword: entry.keyword || "",
      message: entry.message || "validation error",
    }))
    : [];
}

function normalizeScores(scores) {
  const vata = Math.max(0, Number(scores && scores.vata) || 0);
  const pitta = Math.max(0, Number(scores && scores.pitta) || 0);
  const kapha = Math.max(0, Number(scores && scores.kapha) || 0);
  const total = vata + pitta + kapha;

  if (total <= 0) {
    return {
      vata: 1 / 3,
      pitta: 1 / 3,
      kapha: 1 / 3,
    };
  }

  const nv = vata / total;
  const np = pitta / total;
  const nk = 1 - nv - np;

  return {
    vata: nv,
    pitta: np,
    kapha: nk,
  };
}

async function fetchMlPrakriti(payload) {
  const validRequest = validateRequest(payload);
  if (!validRequest) {
    const error = new Error("Prakriti ML request validation failed");
    error.code = "ML_REQUEST_VALIDATION_ERROR";
    error.details = { errors: formatAjvErrors(validateRequest.errors) };
    throw error;
  }

  if (!USE_ML) {
    const error = new Error("ML disabled");
    error.code = "ML_DISABLED";
    throw error;
  }

  const data = await callML(PRAKRITI_ML_ENDPOINT, payload, { request_id: "prakriti_ml" });
  const scores = data && typeof data === "object" && data.scores && typeof data.scores === "object"
    ? data.scores
    : data;

  const validResponse = validateResponse(scores);
  if (!validResponse) {
    const error = new Error("Prakriti ML response validation failed");
    error.code = "ML_RESPONSE_VALIDATION_ERROR";
    error.details = { errors: formatAjvErrors(validateResponse.errors) };
    throw error;
  }

  return normalizeScores(scores);
}

module.exports = {
  fetchMlPrakriti,
};
