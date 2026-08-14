import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Drill-down: category -> subcategory -> merchant -> transactions
router.get("/drilldown", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const { categoryId, merchantId } = req.query as { categoryId?: string; merchantId?: string };

  if (merchantId) {
    const transactions = await prisma.transaction.findMany({
      where: { userId, merchantId },
      orderBy: { date: "desc" },
      include: { category: true },
    });
    return res.json({ level: "transactions", transactions });
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) return res.status(404).json({ error: "Category not found" });
    // if this category has children, show subcategory breakdown; otherwise show merchants
    const children = await prisma.category.findMany({ where: { userId, parentId: categoryId } });
    if (children.length > 0) {
      const rows = await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, categoryId: { in: children.map((c) => c.id) }, type: "expense" },
        _sum: { amountCents: true },
        _count: true,
      });
      const items = rows.map((r) => {
        const c = children.find((x) => x.id === r.categoryId)!;
        return { categoryId: c.id, name: c.name, totalCents: Math.abs(r._sum.amountCents ?? 0), count: r._count };
      }).sort((a, b) => b.totalCents - a.totalCents);
      return res.json({ level: "subcategories", items });
    }
    const rows = await prisma.transaction.groupBy({
      by: ["merchantId"],
      where: { userId, categoryId, type: "expense" },
      _sum: { amountCents: true },
      _count: true,
    });
    const merchants = await prisma.merchant.findMany({ where: { userId, id: { in: rows.map((r) => r.merchantId).filter(Boolean) as string[] } } });
    const items = rows.map((r) => {
      const m = merchants.find((x) => x.id === r.merchantId);
      return { merchantId: r.merchantId, name: m?.rawName ?? "Unknown merchant", totalCents: Math.abs(r._sum.amountCents ?? 0), count: r._count };
    }).sort((a, b) => b.totalCents - a.totalCents);
    return res.json({ level: "merchants", items });
  }

  // top level: root categories
  const topCategories = await prisma.category.findMany({ where: { userId, parentId: null } });
  const rows = await prisma.transaction.findMany({
    where: { userId, type: "expense" },
    select: { categoryId: true, amountCents: true, category: { select: { parentId: true, id: true } } },
  });
  const totals = new Map<string, number>();
  for (const r of rows) {
    let topId = r.categoryId;
    if (r.category?.parentId) topId = r.category.parentId;
    if (!topId) topId = "uncategorized";
    totals.set(topId, (totals.get(topId) ?? 0) + Math.abs(r.amountCents));
  }
  const items = [...totals.entries()].map(([id, total]) => ({
    categoryId: id === "uncategorized" ? null : id,
    name: id === "uncategorized" ? "Uncategorized" : topCategories.find((c) => c.id === id)?.name ?? "Other",
    totalCents: total,
  })).sort((a, b) => b.totalCents - a.totalCents);
  res.json({ level: "categories", items });
});

router.get("/personal-vs-business", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const rows = await prisma.transaction.groupBy({
    by: ["isBusiness", "type"],
    where: { userId, isTransfer: false },
    _sum: { amountCents: true },
  });
  res.json({ rows: rows.map((r) => ({ isBusiness: r.isBusiness, type: r.type, totalCents: Math.abs(r._sum.amountCents ?? 0) })) });
});

export default router;
