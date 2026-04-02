function toSafeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getDoshaAdjustment(state) {
  const safeState = toSafeObject(state);
  const dosha = toSafeObject(safeState.dosha_balance);

  const pitta = toSafeNumber(dosha.pitta, 0);
  const vata = toSafeNumber(dosha.vata, 0);
  const kapha = toSafeNumber(dosha.kapha, 0);

  if (pitta > 0.6) {
    return { reduce: "pitta", boost: "cooling" };
  }

  if (vata > 0.6) {
    return { reduce: "vata", boost: "grounding" };
  }

  if (kapha > 0.6) {
    return { reduce: "kapha", boost: "light" };
  }

  return { reduce: null, boost: "neutral" };
}

module.exports = {
  getDoshaAdjustment,
};
