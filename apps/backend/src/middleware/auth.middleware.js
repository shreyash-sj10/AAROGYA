const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return typeof process.env.JWT_SECRET === "string" ? process.env.JWT_SECRET.trim() : "";
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
    },
  });
}

function verifyToken(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return sendError(res, 503, "Authentication is not configured (set JWT_SECRET)");
  }

  const authHeader = req.headers && typeof req.headers.authorization === "string"
    ? req.headers.authorization
    : "";

  if (!authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Missing or invalid authorization header");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return sendError(res, 401, "Missing bearer token");
  }

  try {
    const decoded = jwt.verify(token, secret);

    const userId = decoded && typeof decoded === "object" && typeof decoded.userId === "string"
      ? decoded.userId
      : "";

    if (!userId) {
      return sendError(res, 401, "Invalid token payload");
    }

    const email = decoded && typeof decoded === "object" && typeof decoded.email === "string"
      ? decoded.email
      : null;

    req.user = {
      id: userId,
      email,
    };

    req.userId = userId;
    return next();
  } catch (_error) {
    return sendError(res, 401, "Invalid or expired token");
  }
}

module.exports = {
  verifyToken,
  authMiddleware: verifyToken,
};
