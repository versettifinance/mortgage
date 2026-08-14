import { prisma } from "../db";

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

const MONTH_NAMES = ["january","february","march","april","may","june","july","august","september","october","november","december"];

function parseMonthToken(token: string, now: Date): { start: Date; end: Date } | null {
  const idx = MONTH_NAMES.findIndex((m) => token.startsWith(m.slice(0, 3)));
  if (idx === -1) return null;
  let year = now.getFullYear();
  const d = new Date(year, idx, 1);
  if (d > now) year -= 1;
  return { start: new Date(year, idx, 1), end: new Date(year, idx + 1, 0, 23, 59, 59, 999) };
}

export interface NlqResult {
  answer: string;
  parsed: boolean;
  intent?: string;
  data?: any;
}

export async function answerQuery(userId: string, query: string): Promise<NlqResult> {
  const q = query.trim().toLowerCase();
  const now = new Date();

  // "how much did I spend at <merchant>"
  let m = q.match(/how much (?:did i|have i) spen[dt] at ([a-z0-9 &'-]+?)(?:\s+(this|last)\s+(week|month|year))?\??$/);
  if (m) {
    const merchant = m[1].trim();
    let range: { start: Date; end: Date } | null = null;
    if (m[2] && m[3]) range = relativeRange(m[2], m[3], now);
    const where: any = {
      userId,
      type: "expense",
      description: { contains: merchant },
    };
    if (range) where.date = { gte: range.start, lte: range.end };
    const agg = await prisma.transaction.aggregate({ where, _sum: { amountCents: true }, _count: true });
    const total = Math.abs(agg._sum.amountCents ?? 0);
    return {
      parsed: true,
      intent: "spend_at_merchant",
      answer: agg._count === 0
        ? `No transactions found matching "${merchant}".`
        : `You spent ${fmtMoney(total)} at "${merchant}" across ${agg._count} transaction(s)${range ? "" : " (all time)"}.`,
      data: { merchant, totalCents: total, count: agg._count },
    };
  }

  // "how much did I spend on <category> this year/month/last N months"
  m = q.match(/how much (?:did i|have i) spen[dt] on ([a-z0-9 &'-]+?)(?:\s+(this|last)\s+(week|month|year))?(?:\s+last\s+(\d+)\s+months?)?\??$/);
  if (m) {
    const catName = m[1].trim();
    let range: { start: Date; end: Date } | null = null;
    if (m[2] && m[3]) range = relativeRange(m[2], m[3], now);
    if (m[4]) {
      const n = parseInt(m[4], 10);
      range = { start: new Date(now.getFullYear(), now.getMonth() - n, 1), end: now };
    }
    const categories = await prisma.category.findMany({ where: { userId } });
    const cat = categories.find((c) => c.name.toLowerCase() === catName || c.name.toLowerCase().includes(catName));
    if (!cat) {
      return { parsed: false, answer: `I couldn't find a category matching "${catName}". Try one of: ${categories.filter(c=>!c.parentId).map(c=>c.name).join(", ")}.` };
    }
    const childIds = categories.filter((c) => c.parentId === cat.id).map((c) => c.id);
    const catIds = [cat.id, ...childIds];
    const where: any = { userId, type: "expense", categoryId: { in: catIds } };
    if (range) where.date = { gte: range.start, lte: range.end };
    const agg = await prisma.transaction.aggregate({ where, _sum: { amountCents: true }, _count: true });
    const total = Math.abs(agg._sum.amountCents ?? 0);
    return {
      parsed: true,
      intent: "spend_on_category",
      answer: `You spent ${fmtMoney(total)} on ${cat.name} across ${agg._count} transaction(s)${range ? "" : " (all time)"}.`,
      data: { category: cat.name, totalCents: total, count: agg._count },
    };
  }

  // "biggest expenses this month"
  m = q.match(/biggest expenses?(?:\s+(this|last)\s+(week|month|year))?/);
  if (m && q.includes("biggest")) {
    let range: { start: Date; end: Date } | null = null;
    if (m[1] && m[2]) range = relativeRange(m[1], m[2], now);
    else range = { start: startOfMonth(now), end: endOfMonth(now) };
    const txns = await prisma.transaction.findMany({
      where: { userId, type: "expense", date: { gte: range.start, lte: range.end } },
      orderBy: { amountCents: "asc" },
      take: 5,
      include: { category: true },
    });
    if (txns.length === 0) return { parsed: true, intent: "biggest_expenses", answer: "No expenses found in that period." };
    const lines = txns.map((t) => `${t.description} — ${fmtMoney(Math.abs(t.amountCents))} (${t.category?.name ?? "Uncategorized"})`);
    return {
      parsed: true,
      intent: "biggest_expenses",
      answer: `Your biggest expenses were:\n${lines.join("\n")}`,
      data: { transactions: txns.map((t) => ({ id: t.id, description: t.description, amountCents: t.amountCents })) },
    };
  }

  // "recurring expenses"
  if (q.includes("recurring")) {
    const txns = await prisma.transaction.findMany({
      where: { userId, type: "expense" },
      select: { description: true, amountCents: true, date: true },
    });
    const groups = new Map<string, { count: number; total: number; description: string }>();
    for (const t of txns) {
      const key = t.description.toLowerCase().replace(/\d+/g, "").trim();
      const g = groups.get(key) ?? { count: 0, total: 0, description: t.description };
      g.count += 1;
      g.total += Math.abs(t.amountCents);
      groups.set(key, g);
    }
    const recurring = [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10);
    if (recurring.length === 0) return { parsed: true, intent: "recurring", answer: "No recurring expenses detected yet (need at least 2 occurrences of the same merchant)." };
    const lines = recurring.map((g) => `${g.description} — appears ${g.count}x, total ${fmtMoney(g.total)}`);
    return { parsed: true, intent: "recurring", answer: `Likely recurring expenses:\n${lines.join("\n")}`, data: { recurring } };
  }

  // "what changed from <month> to <month>"
  m = q.match(/what changed from ([a-z]+) to ([a-z]+)/);
  if (m) {
    const r1 = parseMonthToken(m[1], now);
    const r2 = parseMonthToken(m[2], now);
    if (!r1 || !r2) return { parsed: false, answer: `I couldn't recognize those month names.` };
    const [a, b] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, type: "expense", date: { gte: r1.start, lte: r1.end } }, _sum: { amountCents: true } }),
      prisma.transaction.aggregate({ where: { userId, type: "expense", date: { gte: r2.start, lte: r2.end } }, _sum: { amountCents: true } }),
    ]);
    const totalA = Math.abs(a._sum.amountCents ?? 0);
    const totalB = Math.abs(b._sum.amountCents ?? 0);
    const diff = totalB - totalA;
    const pct = totalA === 0 ? null : (diff / totalA) * 100;
    return {
      parsed: true,
      intent: "month_comparison",
      answer: `Spending went from ${fmtMoney(totalA)} to ${fmtMoney(totalB)} (${diff >= 0 ? "+" : ""}${fmtMoney(diff)}${pct !== null ? `, ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : ""}).`,
      data: { totalA, totalB, diff, pct },
    };
  }

  return {
    parsed: false,
    answer: `I couldn't understand that query. Try things like: "How much did I spend at Starbucks", "How much did I spend on groceries this month", "Biggest expenses this month", "Recurring expenses", or "What changed from June to July".`,
  };
}

function relativeRange(rel: string, unit: string, now: Date): { start: Date; end: Date } {
  if (unit === "week") {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day - (rel === "last" ? 7 : 0));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (unit === "month") {
    const monthOffset = rel === "last" ? -1 : 0;
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  // year
  const yearOffset = rel === "last" ? -1 : 0;
  return { start: new Date(now.getFullYear() + yearOffset, 0, 1), end: new Date(now.getFullYear() + yearOffset, 11, 31, 23, 59, 59, 999) };
}
