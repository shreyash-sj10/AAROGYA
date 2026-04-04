const ANSWER_TO_DOSHA = {
  body_build: {
    thin: "vata",
    medium: "pitta",
    heavy: "kapha",
  },
  skin: {
    dry: "vata",
    warm_oily: "pitta",
    thick_cool: "kapha",
  },
  appetite: {
    irregular: "vata",
    strong: "pitta",
    slow: "kapha",
  },
  energy: {
    variable: "vata",
    intense: "pitta",
    stable: "kapha",
  },
  nature: {
    anxious: "vata",
    irritable: "pitta",
    calm: "kapha",
  },
  sleep: {
    light: "vata",
    moderate: "pitta",
    deep: "kapha",
  },
  climate: {
    warm: "vata",
    cool: "pitta",
    dry: "kapha",
  },
  food_response: {
    bloated: "vata",
    acidic: "pitta",
    sluggish: "kapha",
  },
  work_style: {
    inconsistent: "vata",
    intense: "pitta",
    steady: "kapha",
  },
  weight: {
    lose: "vata",
    stable: "pitta",
    gain: "kapha",
  },
};

function scorePrakritiAnswers(answers) {
  const scores = {
    vata: 0,
    pitta: 0,
    kapha: 0,
  };

  Object.keys(ANSWER_TO_DOSHA).forEach((key) => {
    const mapping = ANSWER_TO_DOSHA[key];
    const value = answers && answers[key];
    const dosha = mapping && value ? mapping[value] : null;

    if (dosha && scores[dosha] !== undefined) {
      scores[dosha] += 1;
    }
  });

  return scores;
}

module.exports = {
  ANSWER_TO_DOSHA,
  scorePrakritiAnswers,
};
