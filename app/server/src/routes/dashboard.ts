import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function resolveRange(range: string, customFrom?: string, customTo?: string): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start: Date, end: Date;
  switch (range) {
    case "this_week": {
      const day = now.getDay();
      start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "last_3_months":
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "last_6_months":
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
      break;
    case "last_12_months":
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      end = now;
      break;
    case "custom":
      start = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customTo ? new Date(customTo) : now;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start, end, prevStart, prevEnd };
}

router.get("/summary", async (req: AuthedRequest, res) => {
  const range = (req.query.range as string) || "this_month";
  const { start, end, prevStart, prevEnd } = resolveRange(range, req.query.from as string, req.query.to as string);
  const userId = req.userId!;

  const baseWhere = { userId, date: { gte: start, lte: end }, isTransfer: false };
  const prevWhere = { userId, date: { gte: prevStart, lte: prevEnd }, isTransfer: false };

  const [income, expense, prevIncome, prevExpense, personalExpense, businessExpense] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...baseWhere, type: "income" }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...baseWhere, type: "expense" }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...prevWhere, type: "income" }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...prevWhere, type: "expense" }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...baseWhere, type: "expense", isBusiness: false }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...baseWhere, type: "expense", isBusiness: true }, _sum: { amountCents: true } }),
  ]);

  const incomeCents = income._sum.amountCents ?? 0;
  const expenseCents = Math.abs(expense._sum.amountCents ?? 0);
  const netCents = incomeCents - expenseCents;
  const prevIncomeCents = prevIncome._sum.amountCents ?? 0;
  const prevExpenseCents = Math.abs(prevExpense._sum.amountCents ?? 0);
  const prevNetCents = prevIncomeCents - prevExpenseCents;

  const pctChange = (curr: number, prev: number) => (prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100);

  const categoryBreakdown = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { ...baseWhere, type: "expense" },
    _sum: { amountCents: true },
    _count: true,
  });
  const categories = await prisma.category.findMany({ where: { userId } });
  const breakdown = categoryBreakdown
    .map((row) => {
      const cat = categories.find((c) => c.id === row.categoryId);
      return {
        categoryId: row.categoryId,
        categoryName: cat?.name ?? "Uncategorized",
        totalCents: Math.abs(row._sum.amountCents ?? 0),
        count: row._count,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  const insights: string[] = [];
  const expensePct = pctChange(expenseCents, prevExpenseCents);
  if (expensePct !== null) {
    insights.push(`Spending is ${expensePct >= 0 ? "up" : "down"} ${Math.abs(expensePct).toFixed(1)}% vs the previous period.`);
  }
  const netPct = pctChange(netCents, prevNetCents);
  if (netPct !== null) {
    insights.push(`Net cash flow is ${netPct >= 0 ? "up" : "down"} ${Math.abs(netPct).toFixed(1)}% vs the previous period.`);
  }
  if (breakdown.length > 0) {
    const top = breakdown[0];
    const pctOfExpense = expenseCents === 0 ? 0 : (top.totalCents / expenseCents) * 100;
    insights.push(`${top.categoryName} is your largest spending category at ${pctOfExpense.toFixed(1)}% of total expenses.`);
  }

  res.json({
    range: { start, end, prevStart, prevEnd },
    incomeCents,
    expenseCents,
    netCents,
    personalExpenseCents: Math.abs(personalExpense._sum.amountCents ?? 0),
    businessExpenseCents: Math.abs(businessExpense._sum.amountCents ?? 0),
    changeVsPrevious: { incomePct: pctChange(incomeCents, prevIncomeCents), expensePct, netPct },
    categoryBreakdown: breakdown,
    insights,
  });
});

router.get("/spending-over-time", async (req: AuthedRequest, res) => {
  const range = (req.query.range as string) || "last_6_months";
  const { start, end } = resolveRange(range, req.query.from as string, req.query.to as string);
  const userId = req.userId!;
  const txns = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end }, isTransfer: false },
    select: { date: true, amountCents: true, type: true },
  });
  const buckets = new Map<string, { income: number; expense: number }>();
  for (const t of txns) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") b.income += t.amountCents;
    if (t.type === "expense") b.expense += Math.abs(t.amountCents);
    buckets.set(key, b);
  }
  const series = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, incomeCents: v.income, expenseCents: v.expense, netCents: v.income - v.expense }));
  res.json({ series });
});

export default router;
