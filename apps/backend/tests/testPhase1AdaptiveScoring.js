const { scoreCandidates } = require("../src/modules/scoring/scoringEngine");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(() => {
  const candidates = {
    dal: [
      {
        recipe_id: "liked_dal",
        name: "liked_dal",
        category: "dal",
        digestibility_score: 0.8,
        nutrition: { calories: 130, protein: 8, glycemic_index: 30 },
        dosha_effect: { vata: 0, pitta: 0, kapha: 0 },
        evaluation: { isValid: true, totalPenalty: 0, triggeredRules: [] },
      },
      {
        recipe_id: "neutral_dal",
        name: "neutral_dal",
        category: "dal",
        digestibility_score: 0.8,
        nutrition: { calories: 130, protein: 8, glycemic_index: 30 },
        dosha_effect: { vata: 0, pitta: 0, kapha: 0 },
        evaluation: { isValid: true, totalPenalty: 0, triggeredRules: [] },
      },
    ],
  };

  const template = {
    id: "phase1_template",
    components: [{ type: "flexible", category: "dal", quantity: 1 }],
  };

  const userState = {
    user_id: "phase1_adaptive_user",
    goal: "maintenance",
    risk_flags: [],
    user_history: {
      liked_foods: ["liked_dal"],
    },
    interaction_logs: [
      { action: "selected", food: "liked_dal" },
      { action: "selected", food: "liked_dal" },
    ],
  };

  const scored = scoreCandidates(candidates, userState, template);
  assert(Array.isArray(scored.dal) && scored.dal.length === 2, "expected 2 dal candidates");
  assert(scored.dal[0].name === "liked_dal", "liked food should rank higher with adaptive scoring");

  const adaptiveBoost = scored.dal[0].breakdown.adaptiveScore;
  assert(adaptiveBoost > 0, "liked food must receive positive adaptiveScore");

  console.log("PASS: adaptive preferences increased ranking for liked/frequently selected food");
})();
