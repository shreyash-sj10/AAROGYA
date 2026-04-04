const decisionRequestSchema = require("./schemas/decision-request.v1.schema.json");
const decisionResponseSchema = require("./schemas/decision-response.v1.schema.json");
const traceSchema = require("./schemas/trace.v1.schema.json");
const weeklyDecisionRequestSchema = require("./schemas/weekly-decision-request.v1.schema.json");
const weeklyDecisionResponseSchema = require("./schemas/weekly-decision-response.v1.schema.json");
const healthResponseSchema = require("./schemas/health-response.v1.schema.json");
const metricsResponseSchema = require("./schemas/metrics-response.v1.schema.json");
const errorResponseSchema = require("./schemas/error-response.v1.schema.json");
const assistantResponseSchema = require("./schemas/assistant-response.v1.schema.json");

const recipeAggregateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "schema_version",
    "compatibility",
    "recipe_id",
    "name",
    "category",
    "ingredients",
    "aggregation_basis",
    "aggregates",
  ],
  properties: {
    version: { type: "string", const: "RecipeAggregate_v1" },
    schema_version: { type: "integer", const: 1 },
    compatibility: { type: "string", enum: ["backward"] },
    recipe_id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    category: { type: "string", minLength: 1 },
    ingredients: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["food_id", "quantity"],
        properties: {
          food_id: { type: "string", minLength: 1 },
          quantity: {
            type: "object",
            additionalProperties: false,
            required: ["value", "unit"],
            properties: {
              value: { type: "number", minimum: 0 },
              unit: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
    aggregation_basis: { type: "string", minLength: 1 },
    aggregates: {
      type: "object",
      additionalProperties: false,
      required: ["nutrition", "dosha_estimate", "functional"],
      properties: {
        nutrition: {
          type: "object",
          additionalProperties: false,
          required: ["calories", "protein", "carbs", "fat", "glycemic_index"],
          properties: {
            calories: { type: "number", minimum: 0 },
            protein: { type: "number", minimum: 0 },
            carbs: { type: "number", minimum: 0 },
            fat: { type: "number", minimum: 0 },
            glycemic_index: { type: "number", minimum: 0, maximum: 100 },
          },
        },
        dosha_estimate: {
          type: "object",
          additionalProperties: false,
          required: ["vata", "pitta", "kapha"],
          properties: {
            vata: { type: "number", minimum: 0, maximum: 1 },
            pitta: { type: "number", minimum: 0, maximum: 1 },
            kapha: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        functional: {
          type: "object",
          additionalProperties: false,
          required: ["digestibility_score", "heaviness_score"],
          properties: {
            digestibility_score: { type: "number", minimum: 0, maximum: 1 },
            heaviness_score: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
};

module.exports = {
  decisionRequestSchema,
  decisionResponseSchema,
  traceSchema,
  weeklyDecisionRequestSchema,
  weeklyDecisionResponseSchema,
  healthResponseSchema,
  metricsResponseSchema,
  errorResponseSchema,
  assistantResponseSchema,
  recipeAggregateSchema,
  schemas: {
    "decision-request.v1.schema.json": decisionRequestSchema,
    "decision-response.v1.schema.json": decisionResponseSchema,
    "trace.v1.schema.json": traceSchema,
    "weekly-decision-request.v1.schema.json": weeklyDecisionRequestSchema,
    "weekly-decision-response.v1.schema.json": weeklyDecisionResponseSchema,
    "health-response.v1.schema.json": healthResponseSchema,
    "metrics-response.v1.schema.json": metricsResponseSchema,
    "error-response.v1.schema.json": errorResponseSchema,
    "assistant-response.v1.schema.json": assistantResponseSchema,
  },
};

