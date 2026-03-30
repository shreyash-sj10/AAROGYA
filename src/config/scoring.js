const SCORING_CONFIG = {
  WEIGHTS: {
    nutrition: 0.3,
    dosha: 0.3,
    digestibility: 0.2,
    familiarity: 0.2,
  },
  NORMALIZATION: {
    MAX_GLYCEMIC_INDEX: 100,
    MAX_PROTEIN: 40,
  },
  DEFAULTS: {
    nutrition: 0.5,
    dosha: 0.5,
    digestibility: 0,
    familiarity: 0,
    penalty: 0,
  },
  GOALS: ["weight_loss", "muscle_gain", "maintenance"],
};

module.exports = {
  SCORING_CONFIG,
};
