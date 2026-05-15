/**
 * AAROGYA Question Bank
 * Deterministic mapping of uncertainty triggers to specific follow-up questions.
 */

const QUESTIONS = {
  CLARIFY_SYMPTOMS: {
    id: "clarify_symptoms",
    type: "single_choice",
    text: "Are you experiencing any specific digestive discomfort or low energy today?",
    options: ["Bloating", "Fatigue", "Acidity", "None"],
    maps_to: "user_state.symptoms"
  },
  CLARIFY_PITTA: {
    id: "clarify_pitta",
    type: "single_choice",
    text: "How do you typically react to hot weather or spicy food?",
    options: ["Love it / Cool head", "Quick to heat / Can't stand it", "Neutral"],
    maps_to: "user_state.dosha_estimate.pitta"
  },
  CLARIFY_GOALS: {
    id: "clarify_goals",
    type: "single_choice",
    text: "What is your primary focus for today's nutrition?",
    options: ["Weight Loss", "Energy Boost", "Better Digestion", "Muscle Gain"],
    maps_to: "user_state.goals"
  },
  BROADEN_PREFERENCES: {
    id: "broaden_preferences",
    type: "single_choice",
    text: "The system had to relax some constraints. Are you open to a wider variety of grains or proteins today?",
    options: ["Yes, widen selection", "No, keep strict"],
    maps_to: "user_state.preferences"
  }
};

function getAllQuestions() {
  return { ...QUESTIONS };
}

module.exports = {
  QUESTIONS,
  getAllQuestions
};
