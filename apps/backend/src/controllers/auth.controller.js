const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "1h";

function getJwtSecretOrRespond(res) {
  const secret = typeof process.env.JWT_SECRET === "string" ? process.env.JWT_SECRET.trim() : "";
  if (!secret) {
    sendError(res, 503, "Authentication is not configured (set JWT_SECRET)");
    return null;
  }
  return secret;
}

function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
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

function logAuthEvent(event, meta = {}) {
  console.info(JSON.stringify({
    event,
    ts: new Date().toISOString(),
    ...meta,
  }));
}

function isDatabaseUnavailable(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = typeof error.code === "string" ? error.code : "";
  if (code === "P1000" || code === "P1001" || code === "P1017") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /can't reach database server|can't reach database|ECONNREFUSED|ENOTFOUND|getaddrinfo|connection timed out/i.test(message);
}

function parseCredentials(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Invalid request body" };
  }

  const safeBody = body;
  const emailRaw = typeof safeBody.email === "string" ? safeBody.email.trim().toLowerCase() : "";
  const passwordRaw = typeof safeBody.password === "string" ? safeBody.password : "";

  if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
    return { ok: false, message: "Valid email is required" };
  }

  if (!passwordRaw || passwordRaw.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters" };
  }

  return {
    ok: true,
    email: emailRaw,
    password: passwordRaw,
  };
}

async function signupController(req, res) {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) {
    return sendError(res, 400, parsed.message);
  }

  if (!getJwtSecretOrRespond(res)) {
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });

    if (existingUser) {
      logAuthEvent("signup_conflict", { email: parsed.email });
      return sendError(res, 409, "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(parsed.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
      },
    });

    logAuthEvent("signup_created", { userId: user.id, email: user.email });

    return sendSuccess(res, 201, {
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      logAuthEvent("signup_conflict", { email: parsed.email, reason: "unique_constraint" });
      return sendError(res, 409, "Email already registered");
    }

    logAuthEvent("signup_failed", {
      email: parsed.email,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    if (isDatabaseUnavailable(error)) {
      return sendError(
        res,
        503,
        "Sign up is unavailable: the database is not reachable. Use local Postgres (docker compose + DATABASE_URL in RUNBOOK) or fix your Supabase connection string and network.",
      );
    }

    return sendError(res, 500, "Internal authentication error");
  }
}

async function loginController(req, res) {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) {
    return sendError(res, 400, parsed.message);
  }

  const jwtSecret = getJwtSecretOrRespond(res);
  if (!jwtSecret) {
    return;
  }

  logAuthEvent("login_attempt", { email: parsed.email });

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      logAuthEvent("login_failed", { email: parsed.email, reason: "user_not_found" });
      return sendError(res, 401, "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(parsed.password, user.password);
    if (!isMatch) {
      logAuthEvent("login_failed", { email: parsed.email, reason: "password_mismatch" });
      return sendError(res, 401, "Invalid credentials");
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: TOKEN_EXPIRY },
    );

    logAuthEvent("login_success", { userId: user.id, email: user.email });

    return sendSuccess(res, 200, {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    logAuthEvent("login_failed", {
      email: parsed.email,
      reason: "internal_error",
      message: error instanceof Error ? error.message : "unknown_error",
    });

    if (isDatabaseUnavailable(error)) {
      return sendError(
        res,
        503,
        "Login is unavailable: the database is not reachable. Check DATABASE_URL or use local Postgres (see docs/RUNBOOK_LOCAL.md).",
      );
    }

    return sendError(res, 500, "Internal authentication error");
  }
}

module.exports = {
  loginController,
  signupController,
};
