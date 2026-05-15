const { getCanonicalP0Rules } = require("../definitions/canonicalRules");

const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const SUPPORTED_OPERATORS = new Set([">", "<", ">=", "<=", "==", "=", "includes"]);

function validateConditionNode(node, path) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new Error(`Invalid rule condition at ${path}: expected object`);
  }

  if (typeof node.entity === "string" && typeof node.operator === "string") {
    if (!SUPPORTED_OPERATORS.has(node.operator)) {
      throw new Error(`Invalid rule operator "${node.operator}" at ${path}`);
    }

    if (!node.entity.trim()) {
      throw new Error(`Invalid rule entity at ${path}`);
    }

    const hasValue = Object.prototype.hasOwnProperty.call(node, "value");
    const hasValueFrom = typeof node.valueFrom === "string" && node.valueFrom.trim() !== "";
    if (!hasValue && !hasValueFrom) {
      throw new Error(`Rule condition missing value/valueFrom at ${path}`);
    }

    return;
  }

  const entries = Object.entries(node);
  if (entries.length !== 1) {
    throw new Error(`Invalid shorthand condition at ${path}`);
  }

  const [entity, expected] = entries[0];
  if (!entity || typeof entity !== "string" || !entity.trim()) {
    throw new Error(`Invalid shorthand entity at ${path}`);
  }

  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const opEntries = Object.entries(expected);
    if (opEntries.length !== 1) {
      throw new Error(`Invalid shorthand operator shape at ${path}`);
    }
    const [operator] = opEntries[0];
    if (!SUPPORTED_OPERATORS.has(operator)) {
      throw new Error(`Invalid shorthand operator "${operator}" at ${path}`);
    }
  }
}

function validateLogicNode(node, path) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new Error(`Invalid logic tree at ${path}`);
  }

  if (isLegacyLogicTree(node)) {
    if (node.logic !== "AND" && node.logic !== "OR") {
      throw new Error(`Invalid legacy logic operator "${node.logic}" at ${path}`);
    }
    node.conditions.forEach((child, index) => validateLogicNode(child, `${path}.conditions[${index}]`));
    return;
  }

  if (Array.isArray(node.AND)) {
    node.AND.forEach((child, index) => validateLogicNode(child, `${path}.AND[${index}]`));
    return;
  }

  if (Array.isArray(node.OR)) {
    node.OR.forEach((child, index) => validateLogicNode(child, `${path}.OR[${index}]`));
    return;
  }

  if (Object.prototype.hasOwnProperty.call(node, "NOT")) {
    validateLogicNode(node.NOT, `${path}.NOT`);
    return;
  }

  validateConditionNode(node, path);
}

function validateRuleSetOrThrow(rules, options = {}) {
  const safeRules = Array.isArray(rules) ? rules : [];
  const label = typeof options.label === "string" && options.label.trim() ? options.label.trim() : "rule_set";
  const requireP0 = options.requireP0 !== false;

  if (safeRules.length === 0) {
    throw new Error(`Invalid ${label}: empty rule set`);
  }

  let p0Count = 0;

  safeRules.forEach((rule, index) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new Error(`Invalid ${label}[${index}]: rule must be object`);
    }

    const ruleId = typeof rule.id === "string" && rule.id.trim() ? rule.id.trim() : `${label}[${index}]`;

    if (!rule.logic_tree || typeof rule.logic_tree !== "object" || Array.isArray(rule.logic_tree)) {
      throw new Error(`Invalid ${ruleId}: missing logic_tree`);
    }

    const priority = typeof rule.priority === "string" ? rule.priority.trim().toUpperCase() : "";
    if (priority === "P0") {
      p0Count += 1;
      const actionType = rule.action && typeof rule.action.type === "string" ? rule.action.type.trim().toLowerCase() : "";
      if (actionType !== "reject") {
        throw new Error(`Invalid ${ruleId}: P0 action must be reject`);
      }
    }

    validateLogicNode(rule.logic_tree, `${ruleId}.logic_tree`);
  });

  if (requireP0 && p0Count === 0) {
    throw new Error(`Invalid ${label}: no P0 rules present`);
  }

  return true;
}

function assertCanonicalRulebaseIntegrity() {
  const canonicalRules = getCanonicalP0Rules();
  validateRuleSetOrThrow(canonicalRules, {
    label: "canonical_p0_rules",
    requireP0: true,
  });
  return true;
}


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

    // ── valueFrom: resolve expected value dynamically from the full evaluation context ──
    // context = { user, food, context } — all candidate and user fields are reachable.
    // This enables cross-entity comparisons such as:
    //   user.allergies includes food.meta.allergy_tag
    // If valueFrom is absent, fall back to literal condition.value (backward-compatible).
    const expectedValue = (typeof condition.valueFrom === "string" && condition.valueFrom.trim() !== "")
      ? getValue(condition.valueFrom, context)
      : condition.value;

    return compareValues(actualValue, condition.operator, expectedValue);
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

// ─── P0 INVARIANT PASS ───────────────────────────────────────────────────────
// P0 rules are evaluated as a strict dedicated first-pass BEFORE any P1/P2/P3
// evaluation. If ANY P0 rule triggers, the candidate is immediately rejected.
// This is an explicit architectural guarantee — NOT sort-order convenience.
// ─────────────────────────────────────────────────────────────────────────────

function applyP0Pass(context, p0Rules) {
  for (const rule of p0Rules) {
    if (!evaluateRule(rule, context)) {
      continue;
    }

    return {
      violated: true,
      triggeredRule: {
        ruleId: rule && rule.id ? rule.id : "",
        priority: "P0",
        action: "reject",
        reason: normalizeReason(rule),
      },
    };
  }

  return { violated: false, triggeredRule: null };
}

function applyRules(food, userState, rules) {
  const context = {
    user: userState && typeof userState === "object" ? userState : {},
    food: food && typeof food === "object" ? food : {},
    context: userState && userState.context && typeof userState.context === "object" ? userState.context : {},
  };
  const sortedRules = sortRules(rules);

  // ── PASS 1: P0 invariant check (strict, non-negotiable, immediate exit) ─────
  const p0Rules = sortedRules.filter((r) => r && r.priority === "P0");
  const p0Result = applyP0Pass(context, p0Rules);

  if (p0Result.violated) {
    return {
      isValid: false,
      totalPenalty: 0,
      triggeredRules: [p0Result.triggeredRule],
      p0_violated: true,
    };
  }

  // ── PASS 2: P1/P2/P3 general evaluation (only reached if P0 clean) ─────────
  const lowerRules = sortedRules.filter((r) => r && r.priority !== "P0");
  let isValid = true;
  let totalPenalty = 0;
  const triggeredRules = [];

  for (const rule of lowerRules) {
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

      if (rule.priority === "P1") {
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
    p0_violated: false,
  };
}

function filterFoods(foods, userState, rules) {
  const canonicalRules = getCanonicalP0Rules();
  const safeFoods = Array.isArray(foods) ? foods : [];
  const safeRules = [...canonicalRules, ...(Array.isArray(rules) ? rules : [])];

  validateRuleSetOrThrow(safeRules, {
    label: "active_rules",
    requireP0: true,
  });
  const validFoods = [];
  const rejectedFoods = [];

  // Pre-compute P0 rule set — stable across all foods in this filter call
  const p0RuleCount = safeRules.filter((r) => r && r.priority === "P0").length;
  const p0ViolatedRuleIds = [];
  let p0ViolationCount = 0;

  safeFoods.forEach((food) => {
    const evaluation = applyRules(food, userState, safeRules);

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

    // Track P0 violation stats
    if (evaluation.p0_violated) {
      p0ViolationCount++;
      if (rejectRule.ruleId && !p0ViolatedRuleIds.includes(rejectRule.ruleId)) {
        p0ViolatedRuleIds.push(rejectRule.ruleId);
      }
    }

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
    stats: {
      inputCount: safeFoods.length,
      outputCount: validFoods.length,
      rejectedCount: rejectedFoods.length,
      reason: "rule_evaluation",
      p0_rules_checked: p0RuleCount,
      p0_violations: p0ViolationCount,
      p0_violated_rule_ids: p0ViolatedRuleIds,
    },
  };
}

assertCanonicalRulebaseIntegrity();

module.exports = {
  SUPPORTED_OPERATORS: [...SUPPORTED_OPERATORS],
  applyRules,
  assertCanonicalRulebaseIntegrity,
  evaluateCondition,
  evaluateLogicTree,
  evaluateRule,
  filterFoods,
  getValue,
  validateRuleSetOrThrow,
};



