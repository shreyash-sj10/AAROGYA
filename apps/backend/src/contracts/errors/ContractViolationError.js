class ContractViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ContractViolationError";
    this.code = "CONTRACT_VIOLATION";
    this.details = details && typeof details === "object" ? { ...details } : {};
  }
}

module.exports = {
  ContractViolationError,
};
