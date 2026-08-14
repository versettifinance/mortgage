import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const accounts = await prisma.account.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "asc" } });
  const balances = await Promise.all(
    accounts.map(async (a) => {
      const agg = await prisma.transaction.aggregate({ where: { accountId: a.id }, _sum: { amountCents: true } });
      return { ...a, balanceCents: agg._sum.amountCents ?? 0 };
    })
  );
  res.json({ accounts: balances });
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, type, institution, isBusiness } = req.body ?? {};
  if (!name || !type) return res.status(400).json({ error: "name and type are required" });
  const account = await prisma.account.create({
    data: { userId: req.userId!, name, type, institution: institution ?? null, isBusiness: !!isBusiness },
  });
  res.status(201).json({ account });
});

router.get("/:id/transactions", async (req: AuthedRequest, res) => {
  const account = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!account) return res.status(404).json({ error: "Account not found" });
  const transactions = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: { date: "desc" },
    include: { category: true, merchant: true },
  });
  res.json({ account, transactions });
});

export default router;
