const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://ayudiet.local/schemas/rule.schema.json",
  title: "AYUDIET Rule Schema",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "priority", "logic_tree", "action"],
  definitions: {
    condition: {
      type: "object",
      additionalProperties: false,
      required: ["entity", "operator", "value"],
      properties: {
        entity: {
          type: "string",
          minLength: 1,
        },
        operator: {
          type: "string",
          enum: ["=", "!=", ">", "<", ">=", "<=", "includes", "between"],
        },
        value: {
          anyOf: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
            {
              type: "array",
              items: {
                anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
              },
            },
          ],
        },
      },
    },
    logicTree: {
      type: "object",
      additionalProperties: false,
      required: ["logic", "conditions"],
      properties: {
        logic: {
          type: "string",
          enum: ["AND", "OR"],
        },
        conditions: {
          type: "array",
          minItems: 1,
          items: {
            oneOf: [{ $ref: "#/definitions/condition" }, { $ref: "#/definitions/logicTree" }],
          },
        },
      },
    },
    action: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: ["reject", "penalize"],
        },
        penalty: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        message_template: {
          type: "string",
          minLength: 1,
        },
      },
      allOf: [
        {
          if: {
            properties: {
              type: { const: "penalize" },
            },
            required: ["type"],
          },
          then: {
            required: ["penalty"],
          },
        },
      ],
    },
  },
  properties: {
    id: {
      type: "string",
      minLength: 1,
    },
    name: {
      type: "string",
      minLength: 1,
    },
    priority: {
      type: "string",
      enum: ["P0", "P1", "P2", "P3"],
    },
    citation: {
      type: "string",
      minLength: 1,
    },
    logic_tree: {
      $ref: "#/definitions/logicTree",
    },
    action: {
      $ref: "#/definitions/action",
    },
  },
};

module.exports = schema;
