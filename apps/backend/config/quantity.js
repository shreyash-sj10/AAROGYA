module.exports = {
  defaultCalories: 2000,

  activityMultipliers: {
    low: 25,
    moderate: 30,
    high: 35,
  },

  goalAdjustments: {
    GOAL_WEIGHT_LOSS: -300,
    GOAL_MAINTENANCE: 0,
    GOAL_MUSCLE_GAIN: 300,
  },

  mealDistribution: {
    breakfast: 0.25,
    lunch: 0.40,
    dinner: 0.35,
  },

  scalingLimits: {
    min: 0.5,
    max: 2.5,
  },
};
