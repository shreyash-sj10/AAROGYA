const { registerPlanRoutes } = require("../plan.routes");
const { registerWeeklyRoutes } = require("./weekly.routes");
const { registerAssistantRoutes } = require("./assistant.routes");
const { registerDecisionActionRoutes } = require("./decisionActions.routes");
const { registerPrakritiRoutes } = require("../../modules/prakriti/prakriti.controller");

function registerApiRoutes(app, deps = {}) {
  registerPlanRoutes(app, deps);
  registerWeeklyRoutes(app, deps);
  registerAssistantRoutes(app, deps);
  registerDecisionActionRoutes(app, deps);
  registerPrakritiRoutes(app, deps);
}

module.exports = {
  registerApiRoutes,
};
