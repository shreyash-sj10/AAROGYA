const ANSWER_ENUMS = {
  body_build: ["thin", "medium", "heavy"],
  skin: ["dry", "warm_oily", "thick_cool"],
  appetite: ["irregular", "strong", "slow"],
  energy: ["variable", "intense", "stable"],
  nature: ["anxious", "irritable", "calm"],
  sleep: ["light", "moderate", "deep"],
  climate: ["warm", "cool", "dry"],
  food_response: ["bloated", "acidic", "sluggish"],
  work_style: ["inconsistent", "intense", "steady"],
  weight: ["lose", "stable", "gain"],
};

const prakritiRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(ANSWER_ENUMS),
      properties: {
        body_build: { type: "string", enum: ANSWER_ENUMS.body_build },
        skin: { type: "string", enum: ANSWER_ENUMS.skin },
        appetite: { type: "string", enum: ANSWER_ENUMS.appetite },
        energy: { type: "string", enum: ANSWER_ENUMS.energy },
        nature: { type: "string", enum: ANSWER_ENUMS.nature },
        sleep: { type: "string", enum: ANSWER_ENUMS.sleep },
        climate: { type: "string", enum: ANSWER_ENUMS.climate },
        food_response: { type: "string", enum: ANSWER_ENUMS.food_response },
        work_style: { type: "string", enum: ANSWER_ENUMS.work_style },
        weight: { type: "string", enum: ANSWER_ENUMS.weight },
      },
    },
    symptoms: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
};

const prakritiResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["vata", "pitta", "kapha", "confidence", "source"],
  properties: {
    vata: { type: "number", minimum: 0, maximum: 1 },
    pitta: { type: "number", minimum: 0, maximum: 1 },
    kapha: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    source: { type: "string", enum: ["rule", "hybrid"] },
  },
};

module.exports = {
  ANSWER_ENUMS,
  prakritiRequestSchema,
  prakritiResponseSchema,
};
