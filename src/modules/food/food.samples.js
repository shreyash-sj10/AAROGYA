
const sampleFoods = [
  {
    id: "grn-001", name: "Basmati Rice", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["light", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.4, pitta: -0.6, kapha: 0.3 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.4 },
    nutrition: { calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, glycemic_index: 52 },
    seasonality: ["summer", "monsoon", "winter"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-002", name: "Wheat", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.7, pitta: -0.5, kapha: 0.8 },
    functional: { digestibility_score: 0.60, heaviness_score: 0.8 },
    nutrition: { calories: 340, protein: 13.2, carbs: 72.0, fat: 2.5, glycemic_index: 65 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-003", name: "Barley", category: "grain",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.4, pitta: -0.7, kapha: -0.8 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 352, protein: 9.9, carbs: 77.7, fat: 1.2, glycemic_index: 28 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-004", name: "Oats", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.5, pitta: 0.3, kapha: 0.6 },
    functional: { digestibility_score: 0.70, heaviness_score: 0.7 },
    nutrition: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, glycemic_index: 55 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-005", name: "Pearl Millet (Bajra)", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["dry", "light"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: 0.2, pitta: 0.6, kapha: -0.6 },
    functional: { digestibility_score: 0.75, heaviness_score: 0.5 },
    nutrition: { calories: 378, protein: 11.0, carbs: 73.0, fat: 4.2, glycemic_index: 54 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-006", name: "Finger Millet (Ragi)", category: "grain",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: 0.1, pitta: 0.4, kapha: -0.5 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.4 },
    nutrition: { calories: 328, protein: 7.3, carbs: 72.0, fat: 1.3, glycemic_index: 68 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-007", name: "Sorghum (Jowar)", category: "grain",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.4, pitta: -0.6, kapha: -0.5 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 329, protein: 10.6, carbs: 72.1, fat: 3.5, glycemic_index: 62 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-008", name: "Brown Rice", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "stable"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.2, pitta: 0.3, kapha: 0.5 },
    functional: { digestibility_score: 0.65, heaviness_score: 0.7 },
    nutrition: { calories: 112, protein: 2.6, carbs: 24.0, fat: 0.9, glycemic_index: 68 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-001", name: "Mung Dal", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.2, pitta: -0.8, kapha: -0.7 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.2 },
    nutrition: { calories: 347, protein: 24.0, carbs: 63.0, fat: 1.2, glycemic_index: 38 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-002", name: "Urad Dal", category: "dal",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: 0.6, kapha: 0.9 },
    functional: { digestibility_score: 0.30, heaviness_score: 0.9 },
    nutrition: { calories: 341, protein: 25.2, carbs: 58.9, fat: 1.6, glycemic_index: 43 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-003", name: "Toor Dal", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["dry", "light"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.6, pitta: -0.3, kapha: -0.5 },
    functional: { digestibility_score: 0.75, heaviness_score: 0.4 },
    nutrition: { calories: 343, protein: 22.0, carbs: 63.0, fat: 1.5, glycemic_index: 29 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-004", name: "Chana Dal", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["dry", "heavy"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.8, pitta: -0.4, kapha: -0.3 },
    functional: { digestibility_score: 0.50, heaviness_score: 0.7 },
    nutrition: { calories: 364, protein: 19.3, carbs: 60.6, fat: 6.0, glycemic_index: 8 },
    seasonality: ["summer", "winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-005", name: "Masoor Dal", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.4, pitta: -0.6, kapha: -0.5 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 353, protein: 25.8, carbs: 60.1, fat: 1.1, glycemic_index: 25 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-006", name: "Rajma (Kidney Beans)", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["heavy", "dry"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.9, pitta: -0.2, kapha: -0.1 },
    functional: { digestibility_score: 0.35, heaviness_score: 0.8 },
    nutrition: { calories: 333, protein: 23.6, carbs: 60.0, fat: 0.8, glycemic_index: 24 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-007", name: "Kabuli Chana", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["heavy", "dry"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.8, pitta: -0.3, kapha: -0.2 },
    functional: { digestibility_score: 0.45, heaviness_score: 0.7 },
    nutrition: { calories: 364, protein: 19.0, carbs: 61.0, fat: 6.0, glycemic_index: 28 },
    seasonality: ["summer", "winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-008", name: "Moth Dal", category: "dal",
    ayurveda: { rasa: ["sweet"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.5, pitta: -0.5, kapha: -0.4 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.3 },
    nutrition: { calories: 343, protein: 23.0, carbs: 62.0, fat: 1.0, glycemic_index: 35 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-001", name: "Bitter Gourd", category: "vegetable",
    ayurveda: { rasa: ["bitter", "pungent"], guna: ["light", "dry"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.6, pitta: -0.7, kapha: -0.8 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.3 },
    nutrition: { calories: 17, protein: 1.0, carbs: 3.7, fat: 0.2, glycemic_index: 15 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-002", name: "Bottle Gourd", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["light", "snigdha"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.3, pitta: -0.8, kapha: 0.1 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.2 },
    nutrition: { calories: 14, protein: 0.6, carbs: 3.4, fat: 0.0, glycemic_index: 15 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-003", name: "Spinach", category: "vegetable",
    ayurveda: { rasa: ["astringent", "sweet"], guna: ["heavy", "dry"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.7, pitta: -0.4, kapha: -0.2 },
    functional: { digestibility_score: 0.60, heaviness_score: 0.6 },
    nutrition: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, glycemic_index: 15 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-004", name: "Pumpkin", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.6, pitta: -0.6, kapha: 0.5 },
    functional: { digestibility_score: 0.70, heaviness_score: 0.7 },
    nutrition: { calories: 26, protein: 1.0, carbs: 6.5, fat: 0.1, glycemic_index: 75 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-005", name: "Cabbage", category: "vegetable",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: 0.8, pitta: -0.3, kapha: -0.4 },
    functional: { digestibility_score: 0.55, heaviness_score: 0.4 },
    nutrition: { calories: 25, protein: 1.3, carbs: 5.8, fat: 0.1, glycemic_index: 10 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-006", name: "Carrot", category: "vegetable",
    ayurveda: { rasa: ["sweet", "bitter"], guna: ["light", "sharp"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.2, pitta: 0.4, kapha: -0.3 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, glycemic_index: 39 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-007", name: "Radish", category: "vegetable",
    ayurveda: { rasa: ["pungent"], guna: ["light", "dry", "mobile"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: 0.4, pitta: 0.7, kapha: -0.8 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.2 },
    nutrition: { calories: 16, protein: 0.7, carbs: 3.4, fat: 0.1, glycemic_index: 15 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-008", name: "Eggplant", category: "vegetable",
    ayurveda: { rasa: ["sweet", "pungent"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: 0.2, pitta: 0.8, kapha: -0.5 },
    functional: { digestibility_score: 0.75, heaviness_score: 0.4 },
    nutrition: { calories: 25, protein: 1.0, carbs: 6.0, fat: 0.2, glycemic_index: 15 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-009", name: "Okra", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.4, pitta: -0.6, kapha: 0.4 },
    functional: { digestibility_score: 0.65, heaviness_score: 0.6 },
    nutrition: { calories: 33, protein: 1.9, carbs: 7.5, fat: 0.2, glycemic_index: 20 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-010", name: "Sweet Potato", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.7, pitta: -0.5, kapha: 0.7 },
    functional: { digestibility_score: 0.60, heaviness_score: 0.8 },
    nutrition: { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, glycemic_index: 54 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-001", name: "Apple", category: "fruit",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.5, pitta: -0.6, kapha: -0.4 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 52, protein: 0.3, carbs: 14.0, fat: 0.2, glycemic_index: 36 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-002", name: "Banana", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.5, kapha: 0.9 },
    functional: { digestibility_score: 0.50, heaviness_score: 0.9 },
    nutrition: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, glycemic_index: 51 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-003", name: "Pomegranate", category: "fruit",
    ayurveda: { rasa: ["sweet", "astringent", "sour"], guna: ["light", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.2, pitta: -0.9, kapha: -0.3 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.2 },
    nutrition: { calories: 83, protein: 1.7, carbs: 18.7, fat: 1.2, glycemic_index: 53 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-004", name: "Mango", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.7, pitta: 0.4, kapha: 0.6 },
    functional: { digestibility_score: 0.65, heaviness_score: 0.8 },
    nutrition: { calories: 60, protein: 0.8, carbs: 15.0, fat: 0.4, glycemic_index: 51 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-005", name: "Grapes", category: "fruit",
    ayurveda: { rasa: ["sweet", "sour"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.6, pitta: -0.8, kapha: 0.4 },
    functional: { digestibility_score: 0.75, heaviness_score: 0.6 },
    nutrition: { calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, glycemic_index: 53 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-006", name: "Papaya", category: "fruit",
    ayurveda: { rasa: ["sweet", "pungent"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.4, pitta: 0.7, kapha: -0.6 },
    functional: { digestibility_score: 0.98, heaviness_score: 0.2 },
    nutrition: { calories: 43, protein: 0.5, carbs: 10.8, fat: 0.3, glycemic_index: 60 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-007", name: "Orange", category: "fruit",
    ayurveda: { rasa: ["sweet", "sour"], guna: ["heavy", "liquid"], virya: "hot", vipaka: "sour" },
    dosha_effect: { vata: -0.5, pitta: 0.5, kapha: 0.4 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.5 },
    nutrition: { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, glycemic_index: 40 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-008", name: "Watermelon", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "liquid"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.2, pitta: -0.8, kapha: 0.7 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.6 },
    nutrition: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2, glycemic_index: 72 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-001", name: "Cow Milk", category: "dairy",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.9, kapha: 0.7 },
    functional: { digestibility_score: 0.60, heaviness_score: 0.8 },
    nutrition: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, glycemic_index: 31 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-002", name: "Cow Ghee", category: "dairy",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.9, pitta: -0.9, kapha: 0.5 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.8 },
    nutrition: { calories: 900, protein: 0.0, carbs: 0.0, fat: 99.5, glycemic_index: 0 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-003", name: "Curd (Yogurt)", category: "dairy",
    ayurveda: { rasa: ["sour", "sweet"], guna: ["heavy", "oily"], virya: "hot", vipaka: "sour" },
    dosha_effect: { vata: -0.6, pitta: 0.8, kapha: 0.9 },
    functional: { digestibility_score: 0.50, heaviness_score: 0.9 },
    nutrition: { calories: 98, protein: 3.5, carbs: 3.4, fat: 4.3, glycemic_index: 28 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-004", name: "Buttermilk", category: "dairy",
    ayurveda: { rasa: ["sour", "astringent"], guna: ["light", "dry"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.5, pitta: 0.2, kapha: -0.7 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.2 },
    nutrition: { calories: 40, protein: 3.3, carbs: 4.8, fat: 0.9, glycemic_index: 35 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-005", name: "Paneer", category: "dairy",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.5, pitta: -0.4, kapha: 0.8 },
    functional: { digestibility_score: 0.40, heaviness_score: 0.9 },
    nutrition: { calories: 296, protein: 11.1, carbs: 3.4, fat: 25.0, glycemic_index: 27 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-001", name: "Cumin", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.5, pitta: 0.3, kapha: -0.6 },
    functional: { digestibility_score: 0.98, heaviness_score: 0.1 },
    nutrition: { calories: 375, protein: 17.8, carbs: 44.2, fat: 22.3, glycemic_index: 5 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-002", name: "Coriander", category: "spice",
    ayurveda: { rasa: ["astringent", "sweet", "bitter"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.2, pitta: -0.8, kapha: -0.4 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.1 },
    nutrition: { calories: 298, protein: 12.4, carbs: 55.0, fat: 17.8, glycemic_index: 5 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-003", name: "Turmeric", category: "spice",
    ayurveda: { rasa: ["bitter", "pungent"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: 0.2, pitta: 0.1, kapha: -0.8 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.2 },
    nutrition: { calories: 354, protein: 7.8, carbs: 64.9, fat: 9.9, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-004", name: "Black Pepper", category: "spice",
    ayurveda: { rasa: ["pungent"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.4, pitta: 0.9, kapha: -0.9 },
    functional: { digestibility_score: 0.99, heaviness_score: 0.1 },
    nutrition: { calories: 251, protein: 10.4, carbs: 64.0, fat: 3.3, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-005", name: "Dry Ginger", category: "spice",
    ayurveda: { rasa: ["pungent"], guna: ["light", "oily"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: 0.3, kapha: -0.7 },
    functional: { digestibility_score: 0.98, heaviness_score: 0.1 },
    nutrition: { calories: 335, protein: 9.0, carbs: 71.6, fat: 4.2, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-006", name: "Fennel", category: "spice",
    ayurveda: { rasa: ["sweet", "pungent", "bitter"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.5, pitta: -0.6, kapha: -0.4 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.1 },
    nutrition: { calories: 345, protein: 15.8, carbs: 52.3, fat: 14.9, glycemic_index: 5 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-007", name: "Cardamom", category: "spice",
    ayurveda: { rasa: ["pungent", "sweet"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.4, pitta: -0.4, kapha: -0.5 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.1 },
    nutrition: { calories: 311, protein: 10.8, carbs: 68.5, fat: 6.7, glycemic_index: 5 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-008", name: "Cinnamon", category: "spice",
    ayurveda: { rasa: ["pungent", "sweet", "bitter"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.6, pitta: 0.7, kapha: -0.8 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.1 },
    nutrition: { calories: 247, protein: 4.0, carbs: 80.6, fat: 1.2, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-009", name: "Amaranth (Rajgira)", category: "grain",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.2, pitta: -0.6, kapha: -0.4 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 371, protein: 13.6, carbs: 65.2, fat: 7.0, glycemic_index: 35 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-010", name: "Quinoa", category: "grain",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "dry"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: 0.3, pitta: 0.2, kapha: -0.5 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.4 },
    nutrition: { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, glycemic_index: 53 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "grn-011", name: "Corn (Maize)", category: "grain",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "dry"], virya: "hot", vipaka: "sweet" },
    dosha_effect: { vata: 0.6, pitta: 0.4, kapha: -0.2 },
    functional: { digestibility_score: 0.60, heaviness_score: 0.7 },
    nutrition: { calories: 365, protein: 9.4, carbs: 74.3, fat: 4.7, glycemic_index: 60 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-009", name: "Horse Gram (Kulthi)", category: "dal",
    ayurveda: { rasa: ["astringent"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: 0.8, pitta: 0.9, kapha: -0.9 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 321, protein: 22.0, carbs: 57.0, fat: 0.5, glycemic_index: 22 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-010", name: "Cowpea (Lobia)", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["heavy", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.7, pitta: -0.4, kapha: -0.3 },
    functional: { digestibility_score: 0.55, heaviness_score: 0.7 },
    nutrition: { calories: 336, protein: 23.5, carbs: 60.0, fat: 1.2, glycemic_index: 38 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "dal-011", name: "Soybean", category: "dal",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.4, pitta: -0.3, kapha: 0.8 },
    functional: { digestibility_score: 0.40, heaviness_score: 0.9 },
    nutrition: { calories: 446, protein: 36.5, carbs: 30.2, fat: 19.9, glycemic_index: 18 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-011", name: "Ash Gourd (Kushmanda)", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["light", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.9, kapha: -0.2 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.3 },
    nutrition: { calories: 13, protein: 0.4, carbs: 3.0, fat: 0.2, glycemic_index: 10 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-012", name: "Drumstick (Shigru)", category: "vegetable",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.3, pitta: 0.6, kapha: -0.8 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.2 },
    nutrition: { calories: 37, protein: 2.1, carbs: 8.5, fat: 0.2, glycemic_index: 15 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-013", name: "Snake Gourd", category: "vegetable",
    ayurveda: { rasa: ["sweet", "bitter"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.2, pitta: -0.7, kapha: -0.5 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.2 },
    nutrition: { calories: 18, protein: 0.9, carbs: 3.3, fat: 0.3, glycemic_index: 15 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-014", name: "Ridge Gourd", category: "vegetable",
    ayurveda: { rasa: ["sweet"], guna: ["light"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: 0.1, pitta: -0.6, kapha: -0.4 },
    functional: { digestibility_score: 0.92, heaviness_score: 0.2 },
    nutrition: { calories: 17, protein: 0.6, carbs: 4.0, fat: 0.1, glycemic_index: 15 },
    seasonality: ["summer"], meta: { is_vegetarian: true }
  },
  {
    id: "veg-015", name: "Pointed Gourd (Parwal)", category: "vegetable",
    ayurveda: { rasa: ["sweet", "bitter"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.2, pitta: 0.3, kapha: -0.6 },
    functional: { digestibility_score: 0.88, heaviness_score: 0.2 },
    nutrition: { calories: 20, protein: 2.0, carbs: 2.2, fat: 0.3, glycemic_index: 15 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-009", name: "Amla (Indian Gooseberry)", category: "fruit",
    ayurveda: { rasa: ["sour", "sweet", "bitter", "astringent", "pungent"], guna: ["light", "dry"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.6, pitta: -0.9, kapha: -0.7 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.2 },
    nutrition: { calories: 44, protein: 0.9, carbs: 10.2, fat: 0.6, glycemic_index: 15 },
    seasonality: ["winter", "summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-010", name: "Lemon (Nimbu)", category: "fruit",
    ayurveda: { rasa: ["sour"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "sour" },
    dosha_effect: { vata: -0.8, pitta: 0.6, kapha: -0.5 },
    functional: { digestibility_score: 0.98, heaviness_score: 0.1 },
    nutrition: { calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, glycemic_index: 20 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-011", name: "Dates (Kharjura)", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.7, kapha: 0.8 },
    functional: { digestibility_score: 0.40, heaviness_score: 0.9 },
    nutrition: { calories: 282, protein: 2.5, carbs: 75.0, fat: 0.4, glycemic_index: 42 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-012", name: "Figs (Anjeer)", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "stable"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.7, pitta: -0.6, kapha: 0.6 },
    functional: { digestibility_score: 0.50, heaviness_score: 0.8 },
    nutrition: { calories: 74, protein: 0.8, carbs: 19.2, fat: 0.3, glycemic_index: 51 },
    seasonality: ["winter", "summer"], meta: { is_vegetarian: true }
  },
  {
    id: "frt-013", name: "Coconut (Fresh)", category: "fruit",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.9, kapha: 0.8 },
    functional: { digestibility_score: 0.35, heaviness_score: 0.9 },
    nutrition: { calories: 354, protein: 3.3, carbs: 15.2, fat: 33.5, glycemic_index: 45 },
    seasonality: ["summer", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-006", name: "Goat Milk", category: "dairy",
    ayurveda: { rasa: ["sweet", "astringent"], guna: ["light", "absorbing"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.6, pitta: -0.7, kapha: -0.2 },
    functional: { digestibility_score: 0.85, heaviness_score: 0.3 },
    nutrition: { calories: 69, protein: 3.6, carbs: 4.5, fat: 4.1, glycemic_index: 24 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-007", name: "Unsalted Butter", category: "dairy",
    ayurveda: { rasa: ["sweet"], guna: ["heavy", "oily"], virya: "cold", vipaka: "sweet" },
    dosha_effect: { vata: -0.8, pitta: -0.8, kapha: 0.7 },
    functional: { digestibility_score: 0.65, heaviness_score: 0.8 },
    nutrition: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1, glycemic_index: 0 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "dry-008", name: "Goat Curd", category: "dairy",
    ayurveda: { rasa: ["sour", "sweet"], guna: ["light", "absorbing"], virya: "hot", vipaka: "sour" },
    dosha_effect: { vata: -0.5, pitta: 0.4, kapha: -0.4 },
    functional: { digestibility_score: 0.80, heaviness_score: 0.4 },
    nutrition: { calories: 75, protein: 4.1, carbs: 4.0, fat: 4.5, glycemic_index: 20 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-009", name: "Asafoetida (Hing)", category: "spice",
    ayurveda: { rasa: ["pungent"], guna: ["light", "oily", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.9, pitta: 0.8, kapha: -0.7 },
    functional: { digestibility_score: 0.98, heaviness_score: 0.1 },
    nutrition: { calories: 297, protein: 4.0, carbs: 67.8, fat: 1.1, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-010", name: "Ajwain (Carom Seeds)", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.8, pitta: 0.8, kapha: -0.8 },
    functional: { digestibility_score: 0.99, heaviness_score: 0.1 },
    nutrition: { calories: 305, protein: 17.1, carbs: 43.0, fat: 21.1, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-011", name: "Fenugreek (Methi)", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.6, pitta: 0.5, kapha: -0.7 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.2 },
    nutrition: { calories: 323, protein: 23.0, carbs: 58.3, fat: 6.4, glycemic_index: 5 },
    seasonality: ["winter", "monsoon"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-012", name: "Mustard Seeds", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry", "sharp"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.5, pitta: 0.9, kapha: -0.8 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.1 },
    nutrition: { calories: 508, protein: 26.1, carbs: 28.1, fat: 36.2, glycemic_index: 5 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-013", name: "Nutmeg (Jaiphal)", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter", "astringent"], guna: ["light", "dry"], virya: "hot", vipaka: "pungent" },
    dosha_effect: { vata: -0.7, pitta: 0.4, kapha: -0.6 },
    functional: { digestibility_score: 0.90, heaviness_score: 0.2 },
    nutrition: { calories: 525, protein: 5.8, carbs: 49.3, fat: 36.3, glycemic_index: 5 },
    seasonality: ["winter"], meta: { is_vegetarian: true }
  },
  {
    id: "spc-014", name: "Clove (Lavanga)", category: "spice",
    ayurveda: { rasa: ["pungent", "bitter"], guna: ["light", "dry", "sharp"], virya: "cold", vipaka: "pungent" },
    dosha_effect: { vata: -0.3, pitta: -0.4, kapha: -0.8 },
    functional: { digestibility_score: 0.95, heaviness_score: 0.1 },
    nutrition: { calories: 274, protein: 6.0, carbs: 65.5, fat: 13.0, glycemic_index: 5 },
    seasonality: ["summer", "winter", "monsoon"], meta: { is_vegetarian: true }
  }
];

module.exports = { sampleFoods };
