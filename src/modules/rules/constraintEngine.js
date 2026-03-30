const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const SUPPORTED_OPERATORS = new Set([">", "<", ">=", "<=", "==", "=", "includes"]);

function getValue(path, context) {
  if (typeof path !== "string" || path.trim() === "") {
    return undefined;
  }

  return path.split(".").reduce((currentValue, key) => {
    if (currentValue === null || currentValue === undefined) {
      return undefined;
    }

    return currentValue[key];
  }, context);
}

function compareValues(actualValue, operator, expectedValue) {
  switch (operator) {
    case "=":
    case "==":
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }

      return actualValue === expectedValue;
    case ">":
      return typeof actualValue === "number" && typeof expectedValue === "number" && actualValue > expectedValue;
    case "<":
      return typeof actualValue === "number" && typeof expectedValue === "number" && actualValue < expectedValue;
    case ">=":
      return typeof actualValue === "number" && typeof expectedValue === "number" && actualValue >= expectedValue;
    case "<=":
      return typeof actualValue === "number" && typeof expectedValue === "number" && actualValue <= expectedValue;
    case "includes":
      return Array.isArray(actualValue) && actualValue.includes(expectedValue);
    default:
      return false;
  }
}

function isOperatorObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 1 && SUPPORTED_OPERATORS.has(keys[0]);
}

function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return false;
  }

  if (typeof condition.entity === "string" && typeof condition.operator === "string") {
    const actualValue = getValue(condition.entity, context);
    return compareValues(actualValue, condition.operator, condition.value);
  }

  const entries = Object.entries(condition);

  if (entries.length !== 1) {
    return false;
  }

  const [path, expected] = entries[0];
  const actualValue = getValue(path, context);

  if (isOperatorObject(expected)) {
    const [[operator, value]] = Object.entries(expected);
    return compareValues(actualValue, operator, value);
  }

  if (Array.isArray(actualValue)) {
    return actualValue.includes(expected);
  }

  return actualValue === expected;
}

function isLegacyLogicTree(tree) {
  return Boolean(tree && typeof tree === "object" && !Array.isArray(tree) && typeof tree.logic === "string" && Array.isArray(tree.conditions));
}

function evaluateLogicTree(tree, context) {
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
    return false;
  }

  if (isLegacyLogicTree(tree)) {
    const normalizedTree = {
      [tree.logic]: tree.conditions,
    };

    return evaluateLogicTree(normalizedTree, context);
  }

  if (Array.isArray(tree.AND)) {
    return tree.AND.every((node) => evaluateLogicTree(node, context));
  }

  if (Array.isArray(tree.OR)) {
    return tree.OR.some((node) => evaluateLogicTree(node, context));
  }

  if (Object.prototype.hasOwnProperty.call(tree, "NOT")) {
    return !evaluateLogicTree(tree.NOT, context);
  }

  return evaluateCondition(tree, context);
}

function evaluateRule(rule, context) {
  if (!rule || typeof rule !== "object") {
    return false;
  }

  return evaluateLogicTree(rule.logic_tree, context);
}

function toSafePenalty(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function normalizeReason(rule) {
  if (rule && rule.action && typeof rule.action.reason === "string" && rule.action.reason.trim() !== "") {
    return rule.action.reason;
  }

  if (rule && rule.action && typeof rule.action.message_template === "string" && rule.action.message_template.trim() !== "") {
    return rule.action.message_template;
  }

  if (rule && typeof rule.name === "string" && rule.name.trim() !== "") {
    return rule.name;
  }

  if (rule && typeof rule.id === "string" && rule.id.trim() !== "") {
    return rule.id;
  }

  return "Unknown rule.";
}

function sortRules(rules) {
  const safeRules = Array.isArray(rules) ? [...rules] : [];

  return safeRules.sort((leftRule, rightRule) => {
    const leftPriority = PRIORITY_ORDER[leftRule && leftRule.priority] ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = PRIORITY_ORDER[rightRule && rightRule.priority] ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftId = leftRule && typeof leftRule.id === "string" ? leftRule.id : "";
    const rightId = rightRule && typeof rightRule.id === "string" ? rightRule.id : "";
    return leftId.localeCompare(rightId);
  });
}

function applyRules(food, userState, rules) {
  const context = {
    user: userState && typeof userState === "object" ? userState : {},
    food: food && typeof food === "object" ? food : {},
    context: userState && userState.context && typeof userState.context === "object" ? userState.context : {},
  };
  const sortedRules = sortRules(rules);
  let isValid = true;
  let totalPenalty = 0;
  const triggeredRules = [];

  for (const rule of sortedRules) {
    if (!evaluateRule(rule, context)) {
      continue;
    }

    const actionType = rule && rule.action ? rule.action.type : undefined;
    const triggeredRule = {
      ruleId: rule && rule.id ? rule.id : "",
      priority: rule && rule.priority ? rule.priority : "",
      action: actionType,
      reason: normalizeReason(rule),
    };

    triggeredRules.push(triggeredRule);

    if (actionType === "reject") {
      isValid = false;

      if (rule.priority === "P0" || rule.priority === "P1") {
        break;
      }

      continue;
    }

    if (actionType === "penalize") {
      totalPenalty = Math.min(1, totalPenalty + toSafePenalty(rule.action && rule.action.penalty));
    }
  }

  return {
    isValid,
    totalPenalty: Number(totalPenalty.toFixed(3)),
    triggeredRules,
  };
}

function filterFoods(foods, userState, rules) {
  const safeFoods = Array.isArray(foods) ? foods : [];
  const validFoods = [];
  const rejectedFoods = [];

  safeFoods.forEach((food) => {
    const evaluation = applyRules(food, userState, rules);

    if (evaluation.isValid) {
      validFoods.push({
        ...food,
        evaluation: {
          isValid: true,
          totalPenalty: evaluation.totalPenalty,
          triggeredRules: evaluation.triggeredRules.map((rule) => ({ ...rule })),
        },
      });

      return;
    }

    const rejectRule = evaluation.triggeredRules.find((rule) => rule.action === "reject") || evaluation.triggeredRules[0] || {
      ruleId: "",
      priority: "",
      reason: "Unknown rule.",
    };

    rejectedFoods.push({
      food: { ...food },
      triggeredRule: {
        ruleId: rejectRule.ruleId,
        priority: rejectRule.priority,
        reason: rejectRule.reason,
      },
    });
  });

  return {
    validFoods,
    rejectedFoods,
  };
}

module.exports = {
  applyRules,
  evaluateCondition,
  evaluateLogicTree,
  evaluateRule,
  filterFoods,
  getValue,
};
