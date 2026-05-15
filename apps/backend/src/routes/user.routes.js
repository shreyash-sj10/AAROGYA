const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/context", authMiddleware, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "User context body is required" });
  }

  try {
    await prisma.userContext.upsert({
      where: { userId: req.userId },
      update: { context: req.body },
      create: { userId: req.userId, context: req.body },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store user context";
    console.error(`[UserContext][POST] user_id=${req.userId || "unknown"} error=${message}`);
    return res.status(500).json({ error: message });
  }
});

router.get("/context", authMiddleware, async (req, res) => {
  try {
    const data = await prisma.userContext.findUnique({
      where: { userId: req.userId },
    });

    return res.status(200).json({
      context: data && typeof data === "object" ? data.context : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user context";
    console.error(`[UserContext][GET] user_id=${req.userId || "unknown"} error=${message}`);
    return res.status(500).json({ error: message });
  }
});

module.exports = router;


