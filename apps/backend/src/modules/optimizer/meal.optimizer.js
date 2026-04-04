const optimizer = require("./optimizer");

function buildLegacyTemplateFromCandidates(candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const categories = Object.keys(safeCandidates)
    .filter((key) => Array.isArray(safeCandidates[key]))
    .sort((a, b) => a.localeCompare(b));

  return {
    id: "legacy_optimizer_template",
    meal_type: "lunch",
    name: "Legacy Optimizer Template",
    components: categories.map((category) => ({
      type: "flexible",
      category,
      quantity: 1,
    })),
    tags: ["legacy"],
    priority: 1,
  };
}

function optimizeMeal(templateOrUserState, maybeCandidates) {
  const maybeTemplate = templateOrUserState && typeof templateOrUserState === "object" ? templateOrUserState : null;

  if (maybeTemplate && typeof maybeTemplate.id === "string" && Array.isArray(maybeTemplate.components)) {
    return optimizer.optimizeMeal(maybeTemplate, maybeCandidates);
  }

  const candidates = maybeCandidates && typeof maybeCandidates === "object" ? maybeCandidates : {};
  const legacyTemplate = buildLegacyTemplateFromCandidates(candidates);
  return optimizer.optimizeMeal(legacyTemplate, candidates);
}

module.exports = {
  ...optimizer,
  optimizeMeal,
};
