const FOOD_CATEGORIES = ["grain", "dal", "vegetable", "fruit", "dairy", "spice"];
const RASA_TYPES = ["sweet", "sour", "salty", "bitter", "pungent", "astringent"];
const GUNA_TYPES = [
  "heavy",
  "light",
  "oily",
  "dry",
  "stable",
  "mobile",
  "sharp",
  "snigdha",
  "liquid",
  "absorbing",
];
const VIRYA_TYPES = ["hot", "cold"];
const VIPAKA_TYPES = ["sweet", "sour", "pungent"];
const SEASONS = ["summer", "winter", "monsoon"];

const foodSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Food Schema",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "category",
    "ayurveda",
    "dosha_effect",
    "functional",
    "nutrition",
    "seasonality",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    category: {
      type: "string",
      enum: FOOD_CATEGORIES,
    },
    ayurveda: {
      type: "object",
      additionalProperties: false,
      required: ["rasa", "guna", "virya", "vipaka"],
      properties: {
        rasa: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "string",
            enum: RASA_TYPES,
          },
        },
        guna: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "string",
            enum: GUNA_TYPES,
          },
        },
        virya: {
          type: "string",
          enum: VIRYA_TYPES,
        },
        vipaka: {
          type: "string",
          enum: VIPAKA_TYPES,
        },
      },
    },
    dosha_effect: {
      type: "object",
      additionalProperties: false,
      required: ["vata", "pitta", "kapha"],
      properties: {
        vata: { type: "number", minimum: -1, maximum: 1, default: 0 },
        pitta: { type: "number", minimum: -1, maximum: 1, default: 0 },
        kapha: { type: "number", minimum: -1, maximum: 1, default: 0 },
      },
    },
    functional: {
      type: "object",
      additionalProperties: false,
      required: ["digestibility_score", "heaviness_score"],
      properties: {
        digestibility_score: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.5,
        },
        heaviness_score: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.5,
        },
      },
    },
    nutrition: {
      type: "object",
      additionalProperties: false,
      required: ["calories", "protein", "carbs", "fat", "glycemic_index"],
      properties: {
        calories: { type: "number", minimum: 0 },
        protein: { type: "number", minimum: 0 },
        carbs: { type: "number", minimum: 0 },
        fat: { type: "number", minimum: 0 },
        glycemic_index: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
      },
    },
    seasonality: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        type: "string",
        enum: SEASONS,
      },
    },
    meta: {
      type: "object",
      additionalProperties: false,
      default: {},
      properties: {
        is_vegetarian: { type: "boolean", default: true },
      },
    },
    extra: {
      type: "object",
      additionalProperties: false,
      default: {},
      properties: {},
    },
  },
};

module.exports = {
  FOOD_CATEGORIES,
  GUNA_TYPES,
  RASA_TYPES,
  SEASONS,
  VIPAKA_TYPES,
  VIRYA_TYPES,
  foodSchema,
};
