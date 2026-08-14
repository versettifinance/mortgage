import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { categorizeMerchant, normalizeMerchant } from "../lib/categorize";
import { logAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "receipts");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Store the captured receipt image + client-side OCR output, for the user to review.
router.post("/", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Receipt image is required (field name: file)" });
  const { ocrText, extractedMerchant, extractedDate, extractedTotalCents } = req.body ?? {};
  const receipt = await prisma.receipt.create({
    data: {
      userId: req.userId!,
      storagePath: req.file.path,
      ocrText: ocrText ?? null,
      extractedMerchant: extractedMerchant ?? null,
      extractedDate: extractedDate ? new Date(extractedDate) : null,
      extractedTotalCents: extractedTotalCents ? parseInt(extractedTotalCents, 10) : null,
    },
  });
  res.status(201).json({ receipt });
});

// Confirm reviewed/edited fields -> creates a real transaction linked to the receipt.
router.post("/:id/confirm", async (req: AuthedRequest, res) => {
  const receipt = await prisma.receipt.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  const { accountId, merchant, date, totalCents, isBusiness, categoryId } = req.body ?? {};
  if (!accountId || !merchant || !date || totalCents === undefined) {
    return res.status(400).json({ error: "accountId, merchant, date, totalCents are required" });
  }
  const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.userId! } });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const normalized = normalizeMerchant(merchant);
  let merchantRow = await prisma.merchant.findFirst({ where: { userId: req.userId!, normalizedName: normalized } });
  if (!merchantRow) {
    merchantRow = await prisma.merchant.create({ data: { userId: req.userId!, rawName: merchant, normalizedName: normalized } });
  }

  let finalCategoryId = categoryId ?? null;
  let categorySource = "manual";
  if (!finalCategoryId) {
    const result = await categorizeMerchant(req.userId!, merchant);
    finalCategoryId = result.categoryId;
    categorySource = result.source;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId!,
      accountId,
      date: new Date(date),
      description: merchant,
      merchantId: merchantRow.id,
      categoryId: finalCategoryId,
      amountCents: -Math.abs(parseInt(totalCents, 10)),
      type: "expense",
      isBusiness: !!isBusiness,
      categorySource,
      categoryConfidence: 1,
    },
    include: { category: true },
  });

  await prisma.receipt.update({ where: { id: receipt.id }, data: { transactionId: transaction.id } });
  await prisma.attachment.create({
    data: {
      userId: req.userId!,
      transactionId: transaction.id,
      filename: path.basename(receipt.storagePath),
      storagePath: receipt.storagePath,
      mimeType: "image/*",
    },
  });
  await logAudit(req.userId!, "transaction_create", "Transaction", transaction.id, "created from receipt scan");

  res.status(201).json({ transaction });
});

export default router;
