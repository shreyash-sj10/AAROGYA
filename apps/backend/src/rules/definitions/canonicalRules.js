/**
 * AAROGYA Canonical P0 Rules (Safety Core)
 * These rules are IMMUTABLE and are forced onto every decision request.
 * Any violation results in a Hard Reject.
 */

const CANONICAL_P0_RULES = [
  {
    id: "SAFETY_ALLERGY_EXCLUSION",
    priority: "P0",
    description: "Strictly exclude foods matching user-declared allergies.",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "user.allergies", operator: "includes", valueFrom: "food.meta.allergy_tag" }
      ]
    },
    action: { type: "reject", message_template: "Safety Violation: Item contains declared allergen." }
  },
  {
    id: "SAFETY_MEDICAL_CONTRAINDICATION",
    priority: "P0",
    description: "Exclude foods contraindicated for user medical conditions.",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "user.conditions", operator: "includes", valueFrom: "food.meta.contraindication_tag" }
      ]
    },
    action: { type: "reject", message_template: "Safety Violation: Item is contraindicated for your medical status." }
  },
  {
    id: "SAFETY_DIETARY_NON_VEGETARIAN_BLOCK",
    priority: "P0",
    description: "Block non-vegetarian items when user diet is vegetarian.",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "context.diet_type", operator: "=", value: "vegetarian" },
        { entity: "food.meta.is_vegetarian", operator: "=", value: false }
      ]
    },
    action: { type: "reject", message_template: "Safety Violation: Non-vegetarian item blocked for vegetarian diet." }
  }
];

function getCanonicalP0Rules() {
  return [...CANONICAL_P0_RULES];
}

module.exports = {
  getCanonicalP0Rules
};
