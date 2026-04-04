const candidateGenerator = require("./candidateGenerator");

function buildLegacyTemplate(categories) {
  return {
    id: "legacy_template",
    meal_type: "lunch",
    name: "Legacy Candidate Template",
    components: (Array.isArray(categories) ? categories : []).map((category) => ({
      type: "flexible",
      category,
      quantity: 1,
    })),
    tags: ["legacy"],
    priority: 1,
  };
}

function generateCandidates(userState, categories, foods, rules, options) {
  const template = buildLegacyTemplate(categories);
  return candidateGenerator.generateCandidates(template, foods, userState, rules, options);
}

module.exports = {
  ...candidateGenerator,
  generateCandidates,
};
