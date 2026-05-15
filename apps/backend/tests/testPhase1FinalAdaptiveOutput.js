const { scoreCandidates } = require("../src/modules/scoring/scoringEngine");
const { optimizeMeal } = require("../src/modules/optimizer/optimizer");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(() => {
  const template = {
    id: "adaptive_optimizer_template",
    meal_type: "lunch",
    name: "Adaptive Optimizer Template",
    tags: ["test"],
    priority: 1,
    components: [{ type: "flexible", category: "grain", quantity: 1 }],
  };

  const candidates = {
    grain: [
      {
        recipe_id: "rice_bowl",
        name: "rice bowl",
        category: "grain",
        functional: { digestibility_score: 0.82 },
        nutrition: { calories: 180, protein: 4, glycemic_index: 55 },
        dosha_effect: { vata: 0, pitta: 0, kapha: 0 },
        evaluation: { isValid: true, totalPenalty: 0, triggeredRules: [] },
      },
      {
        recipe_id: "millet_bowl",
        name: "millet bowl",
        category: "grain",
        functional: { digestibility_score: 0.83 },
        nutrition: { calories: 178, protein: 4, glycemic_index: 54 },
        dosha_effect: { vata: 0, pitta: 0, kapha: 0 },
        evaluation: { isValid: true, totalPenalty: 0, triggeredRules: [] },
      },
    ],
  };

  const neutralUser = {
    user_id: "adaptive_neutral",
    goal: "maintenance",
    risk_flags: [],
    user_history: { liked_foods: [], disliked_foods: [], selected_counts: {} },
    interaction_logs: [],
  };

  const adaptiveUser = {
    user_id: "adaptive_prefer_rice",
    goal: "maintenance",
    risk_flags: [],
    user_history: { liked_foods: ["rice"], disliked_foods: [], selected_counts: { rice: 8 } },
    interaction_logs: [{ action: "selected", food: "rice" }],
  };

  const neutralScored = scoreCandidates(candidates, neutralUser, template);
  const adaptiveScored = scoreCandidates(candidates, adaptiveUser, template);

  const neutralResult = optimizeMeal(template, neutralScored);
  const adaptiveResult = optimizeMeal(template, adaptiveScored);

  const neutralPick = (((neutralResult || {}).breakdown || {}).items || [])[0] || {};
  const adaptivePick = (((adaptiveResult || {}).breakdown || {}).items || [])[0] || {};

  const neutralId = String(neutralPick.recipe_id || neutralPick.id || neutralPick.name || "");
  const adaptiveId = String(adaptivePick.recipe_id || adaptivePick.id || adaptivePick.name || "");

  assert(neutralId.length > 0 && adaptiveId.length > 0, "optimizer did not select candidates");
  assert(neutralId !== adaptiveId, `adaptive should change selected output, got neutral=${neutralId} adaptive=${adaptiveId}`);
  assert(adaptiveId.includes("rice"), `expected adaptive output to favor rice, got ${adaptiveId}`);

  console.log("PASS: adaptive score influences optimizer-selected final output");
})();
