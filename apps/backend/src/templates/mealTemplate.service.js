const mealTemplates = require("./mealTemplates.json");

const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner"];
const VALID_COMPONENT_TYPES = ["fixed", "flexible"];
const VALID_CATEGORIES = ["grain", "dal", "vegetable", "fruit", "dairy", "spice"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidQuantity(value) {
  return Number.isInteger(value) && value >= 1;
}

function validateTemplate(template) {
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    throw new Error("Invalid template structure.");
  }

  if (!isNonEmptyString(template.id)) {
    throw new Error("Template id must be a non-empty string.");
  }

  if (!VALID_MEAL_TYPES.includes(template.meal_type)) {
    throw new Error(`Invalid meal type in template "${template.id}".`);
  }

  if (!isNonEmptyString(template.name)) {
    throw new Error(`Template name must be a non-empty string in template "${template.id}".`);
  }

  if (!Array.isArray(template.components)) {
    throw new Error(`Template "${template.id}" must include a components array.`);
  }

  if (template.components.length === 0) {
    throw new Error(`Template "${template.id}" must include at least one component.`);
  }

  if (!Array.isArray(template.tags) || template.tags.some((tag) => !isNonEmptyString(tag))) {
    throw new Error(`Template "${template.id}" must include valid tags.`);
  }

  if (!Number.isFinite(template.priority)) {
    throw new Error(`Template "${template.id}" must include a numeric priority.`);
  }

  const flexibleCount = template.components.reduce((count, component, index) => {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      throw new Error(`Invalid component at index ${index} in template "${template.id}".`);
    }

    if (!VALID_COMPONENT_TYPES.includes(component.type)) {
      throw new Error(`Invalid component type in template "${template.id}" at index ${index}.`);
    }

    if (!isValidQuantity(component.quantity)) {
      throw new Error(`Component quantity must be an integer >= 1 in template "${template.id}" at index ${index}.`);
    }

    if (component.type === "fixed") {
      if (!isNonEmptyString(component.item)) {
        throw new Error(`Fixed component must include a non-empty item in template "${template.id}" at index ${index}.`);
      }

      if ("category" in component) {
        throw new Error(`Fixed component cannot include category in template "${template.id}" at index ${index}.`);
      }

      return count;
    }

    if (!isNonEmptyString(component.category)) {
      throw new Error(`Flexible component must include a non-empty category in template "${template.id}" at index ${index}.`);
    }

    if (!VALID_CATEGORIES.includes(component.category)) {
      throw new Error(`Invalid category "${component.category}" in template "${template.id}" at index ${index}.`);
    }

    if ("item" in component) {
      throw new Error(`Flexible component cannot include item in template "${template.id}" at index ${index}.`);
    }

    return count + 1;
  }, 0);

  if (flexibleCount < 1) {
    throw new Error(`Template "${template.id}" must include at least one flexible component.`);
  }
}

function validateTemplates(templates) {
  if (!Array.isArray(templates)) {
    throw new Error("Meal templates data must be an array.");
  }

  templates.forEach((template) => {
    validateTemplate(template);
  });
}

validateTemplates(mealTemplates);

function cloneTemplate(template) {
  return {
    ...template,
    components: template.components.map((component) => ({ ...component })),
    tags: [...template.tags],
  };
}

function loadTemplates() {
  return mealTemplates.map(cloneTemplate);
}

function getTemplatesByMealType(mealType) {
  if (!VALID_MEAL_TYPES.includes(mealType)) {
    throw new Error(`Unsupported meal type "${mealType}".`);
  }

  return mealTemplates
    .filter((template) => template.meal_type === mealType)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return a.id.localeCompare(b.id);
    })
    .map(cloneTemplate);
}

function getBestTemplate(mealType) {
  const templates = getTemplatesByMealType(mealType);
  return templates.length > 0 ? templates[0] : null;
}

function extractCategories(template) {
  validateTemplate(template);

  return template.components.reduce((categories, component) => {
    if (component.type !== "flexible") {
      return categories;
    }

    return categories.concat(Array(component.quantity).fill(component.category));
  }, []);
}

function extractFixedItems(template) {
  validateTemplate(template);

  return template.components.reduce((items, component) => {
    if (component.type !== "fixed") {
      return items;
    }

    return items.concat(Array(component.quantity).fill(component.item));
  }, []);
}

module.exports = {
  extractCategories,
  extractFixedItems,
  getBestTemplate,
  getTemplatesByMealType,
  loadTemplates,
  validateTemplate,
};
