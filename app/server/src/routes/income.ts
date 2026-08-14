import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/sources", async (req: AuthedRequest, res) => {
  const sources = await prisma.incomeSource.findMany({ where: { userId: req.userId! } });
  res.json({ sources });
});

router.post("/sources", async (req: AuthedRequest, res) => {
  const { name, type, isBusiness } = req.body ?? {};
  if (!name || !type) return res.status(400).json({ error: "name and type are required" });
  const source = await prisma.incomeSource.create({ data: { userId: req.userId!, name, type, isBusiness: !!isBusiness } });
  res.status(201).json({ source });
});

router.put("/sources/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.incomeSource.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Income source not found" });
  const { name, type, isBusiness } = req.body ?? {};
  const source = await prisma.incomeSource.update({ where: { id: existing.id }, data: { name, type, isBusiness } });
  res.json({ source });
});

router.delete("/sources/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.incomeSource.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Income source not found" });
  await prisma.incomeSource.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.get("/analytics", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.transaction.groupBy({
    by: ["incomeSourceId"],
    where: { userId, type: "income", date: { gte: start, lte: end } },
    _sum: { amountCents: true },
    _count: true,
  });
  const sources = await prisma.incomeSource.findMany({ where: { userId } });
  const items = rows.map((r) => {
    const s = sources.find((x) => x.id === r.incomeSourceId);
    return { incomeSourceId: r.incomeSourceId, name: s?.name ?? "Unassigned", totalCents: r._sum.amountCents ?? 0, count: r._count };
  }).sort((a, b) => b.totalCents - a.totalCents);
  const ytdTotal = items.reduce((sum, i) => sum + i.totalCents, 0);
  res.json({ year, items, ytdTotalCents: ytdTotal });
});

export default router;
