import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const categories = await prisma.category.findMany({ where: { userId: req.userId! }, orderBy: { name: "asc" } });
  const top = categories.filter((c) => !c.parentId);
  const tree = top.map((t) => ({ ...t, children: categories.filter((c) => c.parentId === t.id) }));
  res.json({ categories, tree });
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, parentId, icon, color } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const category = await prisma.category.create({
    data: { userId: req.userId!, name, parentId: parentId ?? null, icon, color, isSystem: false },
  });
  res.status(201).json({ category });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Category not found" });
  const { name, icon, color } = req.body ?? {};
  const category = await prisma.category.update({ where: { id: existing.id }, data: { name, icon, color } });
  res.json({ category });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Category not found" });
  if (existing.isSystem) return res.status(400).json({ error: "Cannot delete a system default category" });
  await prisma.category.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// Category rules (learned + system) management
router.get("/rules", async (req: AuthedRequest, res) => {
  const rules = await prisma.categoryRule.findMany({
    where: { userId: req.userId! },
    include: { category: true },
    orderBy: [{ source: "asc" }, { merchantPattern: "asc" }],
  });
  res.json({ rules });
});

router.delete("/rules/:id", async (req: AuthedRequest, res) => {
  const rule = await prisma.categoryRule.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  await prisma.categoryRule.delete({ where: { id: rule.id } });
  res.json({ ok: true });
});

export default router;
