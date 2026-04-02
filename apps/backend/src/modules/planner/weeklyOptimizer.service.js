function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function round(value) {
  return Number(toSafeNumber(value, 0).toFixed(6));
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeTargets(userTargets) {
  const safeTargets = toSafeObject(userTargets);

  return {
    daily_calories: Math.max(0, toSafeNumber(safeTargets.daily_calories, 0)),
    protein_target: Math.max(0, toSafeNumber(safeTargets.protein_target, 0)),
    carbs_target: Math.max(0, toSafeNumber(safeTargets.carbs_target, 0)),
    fat_target: Math.max(0, toSafeNumber(safeTargets.fat_target, 0)),
  };
}

function getDaySummary(day) {
  const summary = toSafeObject(toSafeObject(day).nutrition_summary);

  return {
    calories: Math.max(0, toSafeNumber(summary.calories, 0)),
    protein: Math.max(0, toSafeNumber(summary.protein, 0)),
    carbs: Math.max(0, toSafeNumber(summary.carbs, 0)),
    fat: Math.max(0, toSafeNumber(summary.fat, 0)),
  };
}

function computeTotals(days) {
  return toSafeArray(days).reduce((acc, day) => {
    const daySummary = getDaySummary(day);
    return {
      calories: round(acc.calories + daySummary.calories),
      protein: round(acc.protein + daySummary.protein),
      carbs: round(acc.carbs + daySummary.carbs),
      fat: round(acc.fat + daySummary.fat),
    };
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
}

function computeDeviation(actualTotals, targetTotals) {
  return {
    calories: round(actualTotals.calories - targetTotals.calories),
    protein: round(actualTotals.protein - targetTotals.protein),
    carbs: round(actualTotals.carbs - targetTotals.carbs),
    fat: round(actualTotals.fat - targetTotals.fat),
  };
}

function identifyImbalance(days, dailyTargets) {
  const safeDays = toSafeArray(days);
  const avgCalories = safeDays.length > 0
    ? safeDays.reduce((sum, day) => sum + getDaySummary(day).calories, 0) / safeDays.length
    : 0;

  const lowProteinDays = [];
  const highCarbDays = [];
  const unevenDistributionDays = [];

  safeDays.forEach((day) => {
    const safeDay = toSafeObject(day);
    const summary = getDaySummary(day);
    const dayNumber = Number.isInteger(safeDay.day) ? safeDay.day : null;

    if (dayNumber === null) {
      return;
    }

    if (dailyTargets.protein_target > 0 && summary.protein < (dailyTargets.protein_target * 0.95)) {
      lowProteinDays.push(dayNumber);
    }

    if (dailyTargets.carbs_target > 0 && summary.carbs > (dailyTargets.carbs_target * 1.05)) {
      highCarbDays.push(dayNumber);
    }

    if (avgCalories > 0 && Math.abs(summary.calories - avgCalories) > (avgCalories * 0.15)) {
      unevenDistributionDays.push(dayNumber);
    }
  });

  return {
    low_protein_days: lowProteinDays,
    high_carb_days: highCarbDays,
    uneven_distribution_days: unevenDistributionDays,
  };
}

function computeDayFactor(daySummary, targets, avgCalories) {
  let factor = 1;

  if (targets.protein_target > 0) {
    const proteinGap = (targets.protein_target - daySummary.protein) / targets.protein_target;
    factor += clamp(proteinGap * 0.2, -0.08, 0.12);
  }

  if (targets.carbs_target > 0 && daySummary.carbs > targets.carbs_target) {
    const carbOver = (daySummary.carbs - targets.carbs_target) / targets.carbs_target;
    factor -= clamp(carbOver * 0.15, 0, 0.08);
  }

  if (targets.daily_calories > 0) {
    const calorieGap = (targets.daily_calories - daySummary.calories) / targets.daily_calories;
    factor += clamp(calorieGap * 0.1, -0.05, 0.05);
  }

  if (avgCalories > 0) {
    if (daySummary.calories > (avgCalories * 1.15)) {
      factor -= 0.05;
    } else if (daySummary.calories < (avgCalories * 0.85)) {
      factor += 0.05;
    }
  }

  return clamp(round(factor), 0.8, 1.2);
}

function scaleMealEntries(entries, factor) {
  return toSafeArray(entries).map((entry) => {
    const safeEntry = toSafeObject(entry);
    const quantity = toSafeObject(safeEntry.quantity);
    const quantityValue = toSafeNumber(quantity.value, NaN);

    if (!Number.isFinite(quantityValue)) {
      return clonePlain(safeEntry);
    }

    return {
      ...clonePlain(safeEntry),
      quantity: {
        ...clonePlain(quantity),
        value: round(Math.max(0, quantityValue * factor)),
      },
    };
  });
}

function scaleDay(day, factor) {
  const safeDay = toSafeObject(day);
  const meals = toSafeObject(safeDay.meals);
  const summary = getDaySummary(day);

  return {
    ...clonePlain(safeDay),
    meals: {
      breakfast: scaleMealEntries(meals.breakfast, factor),
      lunch: scaleMealEntries(meals.lunch, factor),
      dinner: scaleMealEntries(meals.dinner, factor),
    },
    nutrition_summary: {
      calories: round(summary.calories * factor),
      protein: round(summary.protein * factor),
      carbs: round(summary.carbs * factor),
      fat: round(summary.fat * factor),
    },
  };
}

function isSafeOptimizedPlan(days) {
  return toSafeArray(days).every((day) => {
    const meals = toSafeObject(toSafeObject(day).meals);
    const entries = [
      ...toSafeArray(meals.breakfast),
      ...toSafeArray(meals.lunch),
      ...toSafeArray(meals.dinner),
    ];

    return entries.every((entry) => {
      const quantity = toSafeObject(toSafeObject(entry).quantity);
      const value = toSafeNumber(quantity.value, NaN);
      return Number.isFinite(value) && value >= 0;
    });
  });
}

function optimizeWeeklyPlan(weekPlan, userTargets) {
  const safeWeekPlan = toSafeObject(weekPlan);
  const originalDays = clonePlain(toSafeArray(safeWeekPlan.week_plan));
  const targets = normalizeTargets(userTargets);
  const dayCount = originalDays.length;

  if (dayCount === 0) {
    return {
      optimized_week_plan: {
        week_plan: [],
        meta: {
          total_calories: 0,
          diversity_score: toSafeNumber(toSafeObject(safeWeekPlan.meta).diversity_score, 0),
          confidence_avg: toSafeNumber(toSafeObject(safeWeekPlan.meta).confidence_avg, 0.3),
        },
      },
      optimization_summary: {
        before: {},
        after: {},
        adjustments_applied: [],
      },
    };
  }

  const beforeActual = computeTotals(originalDays);
  const beforeTarget = {
    calories: round(targets.daily_calories * dayCount),
    protein: round(targets.protein_target * dayCount),
    carbs: round(targets.carbs_target * dayCount),
    fat: round(targets.fat_target * dayCount),
  };
  const beforeDeviation = computeDeviation(beforeActual, beforeTarget);
  const imbalance = identifyImbalance(originalDays, targets);
  const avgCalories = dayCount > 0 ? beforeActual.calories / dayCount : 0;

  const adjustmentsApplied = [];
  const optimizedDays = originalDays.map((day) => {
    const safeDay = toSafeObject(day);
    const dayNumber = Number.isInteger(safeDay.day) ? safeDay.day : 0;
    const daySummary = getDaySummary(day);
    const factor = computeDayFactor(daySummary, targets, avgCalories);

    if (Math.abs(factor - 1) > 0.000001) {
      adjustmentsApplied.push({
        day: dayNumber,
        adjustment_factor: factor,
      });
    }

    return scaleDay(day, factor);
  });

  if (!isSafeOptimizedPlan(optimizedDays)) {
    const untouchedTotals = computeTotals(originalDays);

    return {
      optimized_week_plan: {
        week_plan: originalDays,
        meta: clonePlain(toSafeObject(safeWeekPlan.meta)),
      },
      optimization_summary: {
        before: {
          weekly_totals: untouchedTotals,
          target_totals: beforeTarget,
          deviation: computeDeviation(untouchedTotals, beforeTarget),
          imbalance,
        },
        after: {
          weekly_totals: untouchedTotals,
          target_totals: beforeTarget,
          deviation: computeDeviation(untouchedTotals, beforeTarget),
          reverted: true,
        },
        adjustments_applied: [],
      },
    };
  }

  const afterActual = computeTotals(optimizedDays);
  const afterDeviation = computeDeviation(afterActual, beforeTarget);

  return {
    optimized_week_plan: {
      week_plan: optimizedDays,
      meta: {
        ...clonePlain(toSafeObject(safeWeekPlan.meta)),
        total_calories: round(afterActual.calories),
      },
    },
    optimization_summary: {
      before: {
        weekly_totals: beforeActual,
        target_totals: beforeTarget,
        deviation: beforeDeviation,
        imbalance,
      },
      after: {
        weekly_totals: afterActual,
        target_totals: beforeTarget,
        deviation: afterDeviation,
        reverted: false,
      },
      adjustments_applied: adjustmentsApplied,
    },
  };
}

module.exports = {
  optimizeWeeklyPlan,
};
