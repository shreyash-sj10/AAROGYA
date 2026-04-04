const scoringEngine = require("./scoringEngine");

function buildLegacyTemplateFromCandidates(candidates) {
  const safeCandidates = candidates && typeof candidates === "object" ? candidates : {};
  const categories = Object.keys(safeCandidates)
    .filter((key) => Array.isArray(safeCandidates[key]))
    .sort((a, b) => a.localeCompare(b));

  return {
    id: "legacy_scoring_template",
    meal_type: "lunch",
    name: "Legacy Scoring Template",
    components: categories.map((category) => ({
      type: "flexible",
      category,
      quantity: 1,
    })),
    tags: ["legacy"],
    priority: 1,
  };
}

function scoreCandidates(firstArg, secondArg, thirdArg) {
  const firstLooksLikeCandidates = firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)
    && Object.keys(firstArg).every((key) => Array.isArray(firstArg[key]) || key === "__stageStats");

  if (firstLooksLikeCandidates) {
    return scoringEngine.scoreCandidates(firstArg, secondArg, thirdArg);
  }

  const userState = firstArg && typeof firstArg === "object" ? firstArg : {};
  const candidates = secondArg && typeof secondArg === "object" ? secondArg : {};
  const template = thirdArg && typeof thirdArg === "object" ? thirdArg : buildLegacyTemplateFromCandidates(candidates);

  return scoringEngine.scoreCandidates(candidates, userState, template);
}

module.exports = {
  ...scoringEngine,
  scoreCandidates,
};
