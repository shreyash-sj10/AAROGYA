const { registerPlanRoutes } = require("../plan.routes");
const { registerWeeklyRoutes } = require("./weekly.routes");
const { registerAssistantRoutes } = require("./assistant.routes");

function registerApiRoutes(app, deps = {}) {
  registerPlanRoutes(app, deps);
  registerWeeklyRoutes(app, deps);
  registerAssistantRoutes(app, deps);
}

module.exports = {
  registerApiRoutes,
};
