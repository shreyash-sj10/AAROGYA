const {
  extractCategories,
  getBestTemplate,
  getTemplatesByMealType,
  loadTemplates,
} = require("./src/modules/templates/mealTemplate.service");

loadTemplates();
const templates = getTemplatesByMealType("breakfast");
const bestTemplate = getBestTemplate("lunch");
const categories = extractCategories(bestTemplate);

console.log({
  templates,
  bestTemplate,
  categories,
});
