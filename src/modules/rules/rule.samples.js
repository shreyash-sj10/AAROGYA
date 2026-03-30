const rules = [
  {
    id: "high_gi_sensitive_reject",
    name: "High GI foods are rejected for high GI sensitive users",
    priority: "P1",
    citation: "AYUDIET metabolic control policy",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_gi_sensitive" },
            { entity: "user.conditions", operator: "includes", value: "diabetes" },
            { entity: "user.conditions", operator: "includes", value: "pcos" }
          ]
        },
        { entity: "food.nutrition.glycemic_index", operator: ">", value: 70 }
      ]
    },
    action: {
      type: "reject",
      message_template: "High glycemic foods are not suitable for this metabolic profile."
    }
  },
  {
    id: "pitta_hot_food_restriction",
    name: "High pitta users should avoid hot foods",
    priority: "P1",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_pitta" },
            { entity: "user.prakriti.pitta", operator: ">", value: 0.6 }
          ]
        },
        { entity: "food.ayurveda.virya", operator: "=", value: "hot" }
      ]
    },
    action: {
      type: "reject",
      message_template: "Hot foods are not suitable for high pitta states."
    }
  },
  {
    id: "pitta_dosha_effect_restriction",
    name: "High pitta users should avoid strong pitta aggravating foods",
    priority: "P1",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_pitta" },
            { entity: "user.prakriti.pitta", operator: ">", value: 0.6 }
          ]
        },
        { entity: "food.dosha_effect.pitta", operator: ">", value: 0.3 }
      ]
    },
    action: {
      type: "reject",
      message_template: "Strong pitta aggravating foods are not suitable for high pitta states."
    }
  },
  {
    id: "kapha_heavy_food_restriction",
    name: "High kapha users should avoid heavy foods",
    priority: "P1",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "user.prakriti.kapha", operator: ">", value: 0.6 },
        {
          logic: "OR",
          conditions: [
            { entity: "food.functional.heaviness_score", operator: ">", value: 0.6 },
            { entity: "food.ayurveda.guna", operator: "includes", value: "heavy" },
            { entity: "food.ayurveda.guna", operator: "includes", value: "oily" }
          ]
        }
      ]
    },
    action: {
      type: "reject",
      message_template: "Heavy or oily foods are not suitable for high kapha states."
    }
  },
  {
    id: "weak_digestion_heavy_food_restriction",
    name: "Weak digestion should avoid very heavy foods",
    priority: "P1",
    citation: "AYUDIET digestive protection policy",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.agni_strength", operator: "<", value: 0.4 },
            { entity: "user.risk_flags", operator: "includes", value: "digestion_weak" }
          ]
        },
        { entity: "food.functional.heaviness_score", operator: ">", value: 0.8 }
      ]
    },
    action: {
      type: "reject",
      message_template: "Very heavy foods are not suitable when digestion is weak."
    }
  },
  {
    id: "vata_dry_food_avoidance",
    name: "High vata users should avoid dry foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_vata" },
            { entity: "user.prakriti.vata", operator: ">", value: 0.6 }
          ]
        },
        { entity: "food.ayurveda.guna", operator: "includes", value: "dry" }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.3,
      message_template: "Dry foods may aggravate high vata states."
    }
  },
  {
    id: "low_agni_heavy_food_avoidance",
    name: "Low agni users should avoid heavy or poorly digestible foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "user.agni_strength", operator: "<", value: 0.4 },
        {
          logic: "OR",
          conditions: [
            { entity: "food.functional.heaviness_score", operator: ">", value: 0.6 },
            { entity: "food.functional.digestibility_score", operator: "<", value: 0.4 }
          ]
        }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.4,
      message_template: "Heavy or poorly digestible foods may not suit low agni states."
    }
  },
  {
    id: "summer_hot_food_avoidance",
    name: "Hot foods should be avoided in summer",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "context.season", operator: "=", value: "summer" },
        {
          logic: "OR",
          conditions: [
            { entity: "food.ayurveda.virya", operator: "=", value: "hot" },
            { entity: "food.dosha_effect.pitta", operator: ">", value: 0.3 }
          ]
        }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.2,
      message_template: "Hot foods are less suitable in summer."
    }
  },
  {
    id: "winter_cold_food_avoidance",
    name: "Cold foods should be avoided in winter for weak digestion",
    priority: "P3",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "context.season", operator: "=", value: "winter" },
        {
          logic: "OR",
          conditions: [
            { entity: "user.agni_strength", operator: "<", value: 0.4 },
            { entity: "user.risk_flags", operator: "includes", value: "digestion_weak" }
          ]
        },
        { entity: "food.ayurveda.virya", operator: "=", value: "cold" }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.15,
      message_template: "Cold foods may be less suitable in winter when digestion is weak."
    }
  },
  {
    id: "monsoon_low_agni_digestibility_rule",
    name: "Monsoon meals should favor digestible foods",
    priority: "P3",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        { entity: "context.season", operator: "=", value: "monsoon" },
        { entity: "food.functional.digestibility_score", operator: "<", value: 0.4 }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.2,
      message_template: "Less digestible foods are not preferred during monsoon."
    }
  },
  {
    id: "pitta_rasa_restriction",
    name: "High pitta users should avoid pungent and sour rasa foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_pitta" },
            { entity: "user.prakriti.pitta", operator: ">", value: 0.6 }
          ]
        },
        {
          logic: "OR",
          conditions: [
            { entity: "food.ayurveda.rasa", operator: "includes", value: "pungent" },
            { entity: "food.ayurveda.rasa", operator: "includes", value: "sour" }
          ]
        }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.25,
      message_template: "Pungent and sour rasa foods may aggravate high pitta states."
    }
  },
  {
    id: "kapha_rasa_restriction",
    name: "High kapha users should avoid sweet and sour rasa foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_kapha" },
            { entity: "user.prakriti.kapha", operator: ">", value: 0.6 }
          ]
        },
        {
          logic: "OR",
          conditions: [
            { entity: "food.ayurveda.rasa", operator: "includes", value: "sweet" },
            { entity: "food.ayurveda.rasa", operator: "includes", value: "sour" }
          ]
        }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.25,
      message_template: "Sweet and sour rasa foods may aggravate high kapha states."
    }
  },
  {
    id: "kapha_guna_restriction",
    name: "High kapha users should avoid oily and heavy guna foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_kapha" },
            { entity: "user.prakriti.kapha", operator: ">", value: 0.6 }
          ]
        },
        {
          logic: "OR",
          conditions: [
            { entity: "food.ayurveda.guna", operator: "includes", value: "oily" },
            { entity: "food.ayurveda.guna", operator: "includes", value: "heavy" }
          ]
        }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.3,
      message_template: "Oily and heavy guna foods may aggravate high kapha states."
    }
  },
  {
    id: "pitta_vipaka_restriction",
    name: "High pitta users should avoid pungent vipaka foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_pitta" },
            { entity: "user.prakriti.pitta", operator: ">", value: 0.6 }
          ]
        },
        { entity: "food.ayurveda.vipaka", operator: "=", value: "pungent" }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.25,
      message_template: "Pungent vipaka foods may aggravate high pitta states."
    }
  },
  {
    id: "kapha_vipaka_restriction",
    name: "High kapha users should avoid sweet vipaka foods",
    priority: "P2",
    citation: "Charaka Samhita, Sutrasthana, Chapter 1",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.risk_flags", operator: "includes", value: "high_kapha" },
            { entity: "user.prakriti.kapha", operator: ">", value: 0.6 }
          ]
        },
        { entity: "food.ayurveda.vipaka", operator: "=", value: "sweet" }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.25,
      message_template: "Sweet vipaka foods may aggravate high kapha states."
    }
  },
  {
    id: "acidity_hot_food_restriction",
    name: "Acidity symptoms should avoid hot foods",
    priority: "P2",
    citation: "AYUDIET symptom management policy",
    logic_tree: {
      logic: "AND",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { entity: "user.symptom_tags", operator: "includes", value: "acidity" },
            { entity: "user.risk_flags", operator: "includes", value: "high_pitta" }
          ]
        },
        { entity: "food.ayurveda.virya", operator: "=", value: "hot" }
      ]
    },
    action: {
      type: "penalize",
      penalty: 0.3,
      message_template: "Hot foods may worsen acidity symptoms."
    }
  }
];

module.exports = rules;
