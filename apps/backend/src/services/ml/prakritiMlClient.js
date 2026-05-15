const Ajv = require("ajv");

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

function inferPrakritiDeterministic(payload) {
  const answers = payload && payload.answers && typeof payload.answers === "object" ? payload.answers : {};
  let vata = 0;
  let pitta = 0;
  let kapha = 0;

  const score = {
    body_build: { thin: [2, 0, 0], medium: [0, 1, 0], heavy: [0, 0, 2] },
    skin: { dry: [2, 0, 0], warm_oily: [0, 2, 0], thick_cool: [0, 0, 2] },
    appetite: { irregular: [2, 0, 0], strong: [0, 2, 0], slow: [0, 0, 2] },
    energy: { variable: [2, 0, 0], intense: [0, 2, 0], stable: [0, 0, 2] },
    nature: { anxious: [2, 0, 0], irritable: [0, 2, 0], calm: [0, 0, 2] },
    sleep: { light: [2, 0, 0], moderate: [0, 1, 0], deep: [0, 0, 2] },
    climate: { dry: [2, 0, 0], warm: [0, 2, 0], cool: [0, 0, 2] },
    food_response: { bloated: [2, 0, 0], acidic: [0, 2, 0], sluggish: [0, 0, 2] },
    work_style: { inconsistent: [2, 0, 0], intense: [0, 2, 0], steady: [0, 0, 2] },
    weight: { lose: [2, 0, 0], stable: [0, 1, 0], gain: [0, 0, 2] },
  };

  Object.keys(score).forEach((key) => {
    const answer = String(answers[key] || "");
    const [a, b, c] = score[key][answer] || [0, 0, 0];
    vata += a;
    pitta += b;
    kapha += c;
  });

  return normalizeScores({ vata, pitta, kapha });
}

async function fetchMlPrakriti(payload) {
  const validRequest = validateRequest(payload);
  if (!validRequest) {
    const error = new Error("Prakriti ML request validation failed");
    error.code = "ML_REQUEST_VALIDATION_ERROR";
    error.details = { errors: formatAjvErrors(validateRequest.errors) };
    throw error;
  }

  const scores = inferPrakritiDeterministic(payload);

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
