const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

function resolveEntity(path, data) {
  if (typeof path !== "string" || path.trim() === "") {
    return undefined;
  }

  return path.split(".").reduce((currentValue, key) => {
    if (currentValue === null || currentValue === undefined) {
      return undefined;
    }

    return currentValue[key];
  }, data);
}

function evaluateCondition(condition, data) {
  if (!condition || typeof condition !== "object") {
    return false;
  }

  const actualValue = resolveEntity(condition.entity, data);
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "=":
      return actualValue === expectedValue;
    case "!=":
      return actualValue !== expectedValue;
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
    case "between":
      return (
        typeof actualValue === "number" &&
        Array.isArray(expectedValue) &&
        expectedValue.length === 2 &&
        typeof expectedValue[0] === "number" &&
        typeof expectedValue[1] === "number" &&
        actualValue >= expectedValue[0] &&
        actualValue <= expectedValue[1]
      );
    default:
      return false;
  }
}

function isLogicTree(node) {
  return Boolean(node && typeof node === "object" && typeof node.logic === "string" && Array.isArray(node.conditions));
}

function evaluateLogicTree(tree, data) {
  if (!isLogicTree(tree)) {
    return false;
  }

  if (tree.logic === "AND") {
    for (const node of tree.conditions) {
      const matches = isLogicTree(node)
        ? evaluateLogicTree(node, data)
        : evaluateCondition(node, data);

      if (!matches) {
        return false;
      }
    }

    return true;
  }

  if (tree.logic === "OR") {
    for (const node of tree.conditions) {
      const matches = isLogicTree(node)
        ? evaluateLogicTree(node, data)
        : evaluateCondition(node, data);

      if (matches) {
        return true;
      }
    }

    return false;
  }

  return false;
}

function evaluateRule(rule, user, food, context) {
  const evaluationData = { user, food, context };

  return {
    triggered: evaluateLogicTree(rule && rule.logic_tree, evaluationData),
    action: rule ? rule.action : undefined,
    priority: rule ? rule.priority : undefined,
    rule_id: rule ? rule.id : undefined,
  };
}

function normalizeMessage(rule, action) {
  if (action && typeof action.message_template === "string" && action.message_template.trim() !== "") {
    return action.message_template;
  }

  if (rule && typeof rule.id === "string" && rule.id.trim() !== "") {
    return rule.id;
  }

  return "unknown_rule";
}

function finalizeResult(result) {
  const totalPenalty = Math.min(1, Number((result.total_penalty || 0).toFixed(2)));

  return {
    is_valid: Boolean(result.is_valid),
    total_penalty: totalPenalty,
    triggered_rules: Array.isArray(result.triggered_rules) ? result.triggered_rules : [],
  };
}

function applyRules(rules, user, food, context) {
  if (!Array.isArray(rules)) {
    return finalizeResult({
      is_valid: false,
      total_penalty: 0,
      triggered_rules: [],
    });
  }

  const sortedRules = [...rules].sort((leftRule, rightRule) => {
    const leftPriority = PRIORITY_ORDER[leftRule && leftRule.priority] ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = PRIORITY_ORDER[rightRule && rightRule.priority] ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftId = leftRule && leftRule.id ? leftRule.id : "";
    const rightId = rightRule && rightRule.id ? rightRule.id : "";
    return leftId.localeCompare(rightId);
  });

  const result = {
    is_valid: true,
    total_penalty: 0,
    triggered_rules: [],
  };

  for (const rule of sortedRules) {
    const evaluation = evaluateRule(rule, user, food, context);

    if (!evaluation.triggered) {
      continue;
    }

    result.triggered_rules.push({
      rule_id: evaluation.rule_id,
      priority: evaluation.priority,
      message: normalizeMessage(rule, evaluation.action),
    });

    if (evaluation.action && evaluation.action.type === "reject") {
      if (evaluation.priority === "P0" || evaluation.priority === "P1") {
        return finalizeResult({
          is_valid: false,
          total_penalty: 0,
          triggered_rules: result.triggered_rules,
        });
      }

      result.is_valid = false;
      continue;
    }

    if (evaluation.action && evaluation.action.type === "penalize") {
      const penalty = typeof evaluation.action.penalty === "number" ? evaluation.action.penalty : 0;
      result.total_penalty = 1 - (1 - result.total_penalty) * (1 - penalty);
    }
  }

  return finalizeResult(result);
}

module.exports = {
  applyRules,
  evaluateCondition,
  evaluateLogicTree,
  evaluateRule,
  resolveEntity,
};
