import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { categorizeMerchant, normalizeMerchant } from "../lib/categorize";
import { logAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "statements");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Expected CSV columns (case-insensitive, order-independent):
// date, description, amount, type(optional: income/expense/transfer)
function parseAmountToCents(raw: string): number {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const val = parseFloat(cleaned);
  return Math.round(val * 100);
}

router.post("/upload", upload.single("file"), async (req: AuthedRequest, res) => {
  const { accountId } = req.body ?? {};
  if (!req.file) return res.status(400).json({ error: "CSV file is required (field name: file)" });
  if (!accountId) return res.status(400).json({ error: "accountId is required" });
  const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.userId! } });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const content = fs.readFileSync(req.file.path, "utf-8");
  let records: any[];
  try {
    records = parse(content, { columns: (header) => header.map((h: string) => h.trim().toLowerCase()), skip_empty_lines: true, trim: true });
  } catch (err: any) {
    return res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }

  const statement = await prisma.statement.create({
    data: {
      userId: req.userId!,
      accountId,
      filename: req.file.originalname,
      storagePath: req.file.path,
      status: "pending",
    },
  });

  const existingTxns = await prisma.transaction.findMany({
    where: { userId: req.userId! },
    select: { date: true, amountCents: true, description: true },
  });

  let importedCount = 0;
  let categorizedCount = 0;
  let needsReviewCount = 0;
  let duplicateCount = 0;

  for (const row of records) {
    const dateStr = row.date || row["transaction date"] || row["posted date"];
    const description = row.description || row.merchant || row.memo || "";
    const amountRaw = row.amount ?? row.debit ?? row.credit;
    if (!dateStr || !description || amountRaw === undefined || amountRaw === "") continue;

    let amountCents = parseAmountToCents(String(amountRaw));
    if (row.debit && !row.amount) amountCents = -Math.abs(amountCents);
    if (row.credit && !row.amount) amountCents = Math.abs(amountCents);
    if (Number.isNaN(amountCents)) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    let type = (row.type || "").toLowerCase();
    if (!type) type = amountCents < 0 ? "expense" : "income";

    const isTransferKeyword = /transfer|e-transfer|etransfer/i.test(description);
    if (isTransferKeyword) type = "transfer";

    // duplicate detection: same amount + date (+/- 0 days) + similar merchant text among existing transactions
    const normDesc = normalizeMerchant(description);
    const isDuplicate = existingTxns.some((t) => {
      const sameAmount = t.amountCents === amountCents;
      const sameDate = Math.abs(t.date.getTime() - date.getTime()) < 24 * 60 * 60 * 1000;
      const similar = normalizeMerchant(t.description).includes(normDesc.split(" ")[0] || "") || normDesc.includes(normalizeMerchant(t.description).split(" ")[0] || "");
      return sameAmount && sameDate && similar;
    });

    let categoryId: string | null = null;
    let categorySource = "uncategorized";
    let categoryConfidence: number | null = 0;
    let needsReview = false;

    if (type === "expense") {
      const result = await categorizeMerchant(req.userId!, description);
      categoryId = result.categoryId;
      categorySource = result.source;
      categoryConfidence = result.confidence;
      if (result.source === "uncategorized" || result.confidence < 0.5) needsReview = true;
      else categorizedCount++;
    } else {
      categorizedCount++;
    }
    if (isDuplicate) needsReview = true;

    let merchant = await prisma.merchant.findFirst({ where: { userId: req.userId!, normalizedName: normDesc } });
    if (!merchant) {
      merchant = await prisma.merchant.create({ data: { userId: req.userId!, rawName: description, normalizedName: normDesc } });
    }

    await prisma.transaction.create({
      data: {
        userId: req.userId!,
        accountId,
        date,
        description,
        merchantId: merchant.id,
        categoryId,
        amountCents,
        type,
        isTransfer: type === "transfer",
        categorySource,
        categoryConfidence,
        needsReview,
        isDuplicate,
        statementId: statement.id,
      },
    });

    importedCount++;
    if (needsReview) needsReviewCount++;
    if (isDuplicate) duplicateCount++;
  }

  const updated = await prisma.statement.update({
    where: { id: statement.id },
    data: { importedCount, categorizedCount, needsReviewCount, duplicateCount },
  });

  await logAudit(req.userId!, "statement_import", "Statement", statement.id, `${importedCount} imported, ${categorizedCount} categorized, ${needsReviewCount} need review, ${duplicateCount} possible duplicates`);

  res.status(201).json({ statement: updated });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const statement = await prisma.statement.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!statement) return res.status(404).json({ error: "Statement not found" });
  const transactions = await prisma.transaction.findMany({
    where: { statementId: statement.id },
    include: { category: true, merchant: true },
    orderBy: { date: "desc" },
  });
  res.json({ statement, transactions });
});

router.get("/", async (req: AuthedRequest, res) => {
  const statements = await prisma.statement.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" } });
  res.json({ statements });
});

// Approve/commit the reviewed import; any remaining flagged duplicates the user
// explicitly wants removed can be deleted first via the transactions API.
router.post("/:id/commit", async (req: AuthedRequest, res) => {
  const statement = await prisma.statement.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!statement) return res.status(404).json({ error: "Statement not found" });
  const updated = await prisma.statement.update({ where: { id: statement.id }, data: { status: "committed" } });
  res.json({ statement: updated });
});

export default router;
