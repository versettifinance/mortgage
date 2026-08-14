import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { categorizeMerchant, learnFromCorrection, normalizeMerchant } from "../lib/categorize";
import { logAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

function parseDateRange(query: any) {
  const { dateFrom, dateTo } = query;
  const where: any = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom as string);
    if (dateTo) where.date.lte = new Date(dateTo as string);
  }
  return where;
}

router.get("/", async (req: AuthedRequest, res) => {
  const { merchant, categoryId, accountId, isBusiness, type, minAmount, maxAmount, search } = req.query;
  const where: any = { userId: req.userId!, ...parseDateRange(req.query) };
  if (categoryId) where.categoryId = categoryId as string;
  if (accountId) where.accountId = accountId as string;
  if (isBusiness === "true") where.isBusiness = true;
  if (isBusiness === "false") where.isBusiness = false;
  if (type) where.type = type as string;
  if (merchant) where.description = { contains: merchant as string };
  if (search) where.description = { contains: search as string };
  if (minAmount || maxAmount) {
    where.amountCents = {};
    if (minAmount) where.amountCents.gte = parseInt(minAmount as string, 10);
    if (maxAmount) where.amountCents.lte = parseInt(maxAmount as string, 10);
  }
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: { category: true, merchant: true, account: true, splits: true, businessEntity: true, incomeSource: true },
  });
  res.json({ transactions });
});

router.post("/", async (req: AuthedRequest, res) => {
  const { accountId, date, description, amountCents, type, isBusiness, categoryId, notes, incomeSourceId, businessEntityId } = req.body ?? {};
  if (!accountId || !date || !description || amountCents === undefined || !type) {
    return res.status(400).json({ error: "accountId, date, description, amountCents, type are required" });
  }
  const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.userId! } });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const normalized = normalizeMerchant(description);
  let merchant = await prisma.merchant.findFirst({ where: { userId: req.userId!, normalizedName: normalized } });
  if (!merchant) {
    merchant = await prisma.merchant.create({ data: { userId: req.userId!, rawName: description, normalizedName: normalized } });
  }

  let finalCategoryId = categoryId ?? null;
  let categorySource = "manual";
  let categoryConfidence: number | null = 1;
  if (!finalCategoryId && type === "expense") {
    const result = await categorizeMerchant(req.userId!, description);
    finalCategoryId = result.categoryId;
    categorySource = result.source;
    categoryConfidence = result.confidence;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId!,
      accountId,
      date: new Date(date),
      description,
      merchantId: merchant.id,
      categoryId: finalCategoryId,
      amountCents,
      type,
      isBusiness: !!isBusiness,
      notes: notes ?? null,
      categorySource,
      categoryConfidence,
      incomeSourceId: incomeSourceId ?? null,
      businessEntityId: businessEntityId ?? null,
    },
    include: { category: true, merchant: true },
  });
  await logAudit(req.userId!, "transaction_create", "Transaction", transaction.id, description);
  res.status(201).json({ transaction });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  const { date, description, amountCents, type, isBusiness, categoryId, notes, incomeSourceId, businessEntityId } = req.body ?? {};

  // If category is being manually changed, learn from the correction.
  if (categoryId && categoryId !== existing.categoryId) {
    await learnFromCorrection(req.userId!, description ?? existing.description, categoryId);
    await logAudit(req.userId!, "category_correction", "Transaction", existing.id, `category -> ${categoryId}`);
  }

  const transaction = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      date: date ? new Date(date) : undefined,
      description,
      amountCents,
      type,
      isBusiness,
      categoryId,
      notes,
      incomeSourceId,
      businessEntityId,
      categorySource: categoryId && categoryId !== existing.categoryId ? "user_learned" : undefined,
      categoryConfidence: categoryId && categoryId !== existing.categoryId ? 1 : undefined,
    },
    include: { category: true, merchant: true },
  });
  await logAudit(req.userId!, "transaction_update", "Transaction", transaction.id);
  res.json({ transaction });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  await prisma.transaction.delete({ where: { id: existing.id } });
  await logAudit(req.userId!, "transaction_delete", "Transaction", existing.id, existing.description);
  res.json({ ok: true });
});

// Split allocation (personal/business) for a single transaction
router.post("/:id/splits", async (req: AuthedRequest, res) => {
  const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  const { splits } = req.body ?? {};
  if (!Array.isArray(splits) || splits.length === 0) return res.status(400).json({ error: "splits array is required" });
  const total = splits.reduce((sum: number, s: any) => sum + s.amountCents, 0);
  if (Math.abs(total) !== Math.abs(existing.amountCents)) {
    return res.status(400).json({ error: `Split amounts (${total}) must sum to the transaction amount (${existing.amountCents})` });
  }
  await prisma.transactionSplit.deleteMany({ where: { transactionId: existing.id } });
  await prisma.transactionSplit.createMany({
    data: splits.map((s: any) => ({ transactionId: existing.id, label: s.label, amountCents: s.amountCents, isBusiness: !!s.isBusiness })),
  });
  const updated = await prisma.transaction.findUnique({ where: { id: existing.id }, include: { splits: true } });
  await logAudit(req.userId!, "transaction_update", "Transaction", existing.id, "split allocation updated");
  res.json({ transaction: updated });
});

router.get("/export/csv", async (req: AuthedRequest, res) => {
  const { merchant, categoryId, accountId, isBusiness, type, minAmount, maxAmount, search } = req.query;
  const where: any = { userId: req.userId!, ...parseDateRange(req.query) };
  if (categoryId) where.categoryId = categoryId as string;
  if (accountId) where.accountId = accountId as string;
  if (isBusiness === "true") where.isBusiness = true;
  if (isBusiness === "false") where.isBusiness = false;
  if (type) where.type = type as string;
  if (merchant) where.description = { contains: merchant as string };
  if (search) where.description = { contains: search as string };
  if (minAmount || maxAmount) {
    where.amountCents = {};
    if (minAmount) where.amountCents.gte = parseInt(minAmount as string, 10);
    if (maxAmount) where.amountCents.lte = parseInt(maxAmount as string, 10);
  }
  const transactions = await prisma.transaction.findMany({ where, orderBy: { date: "desc" }, include: { category: true, account: true } });
  const rows = [["Date", "Description", "Category", "Account", "Amount", "Type", "Personal/Business"]];
  for (const t of transactions) {
    rows.push([
      t.date.toISOString().slice(0, 10),
      t.description.replace(/"/g, '""'),
      t.category?.name ?? "Uncategorized",
      t.account.name,
      (t.amountCents / 100).toFixed(2),
      t.type,
      t.isBusiness ? "Business" : "Personal",
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=transactions_export.csv");
  res.send(csv);
});

export default router;
