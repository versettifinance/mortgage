import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { ensureCategoryTree, seedSystemCategoryRules } from "../lib/categorize";
import { logAudit } from "../lib/audit";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

function signToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ userId }, secret, { expiresIn: (process.env.JWT_EXPIRES_IN as any) || "2h" });
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });
  await ensureCategoryTree(user.id);
  await seedSystemCategoryRules(user.id);
  await prisma.account.create({ data: { userId: user.id, name: "Main Checking", type: "checking" } });

  const token = signToken(user.id);
  await logAudit(user.id, "login", "User", user.id, "registered + first login");
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, isDemo: user.isDemo } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });
  const token = signToken(user.id);
  await logAudit(user.id, "login", "User", user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, isDemo: user.isDemo } });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email, name: user.name, isDemo: user.isDemo } });
});

export default router;
