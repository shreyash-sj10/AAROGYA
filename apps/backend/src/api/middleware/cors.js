function createCors({ allowOrigin = "*" } = {}) {
  return function cors(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-request-id, x-trace-id");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

module.exports = {
  createCors,
};
