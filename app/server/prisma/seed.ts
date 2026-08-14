import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureCategoryTree, seedSystemCategoryRules, categorizeMerchant, normalizeMerchant } from "../src/lib/categorize";

const prisma = new PrismaClient();

async function getOrCreateMerchant(userId: string, name: string) {
  const normalized = normalizeMerchant(name);
  let merchant = await prisma.merchant.findFirst({ where: { userId, normalizedName: normalized } });
  if (!merchant) {
    merchant = await prisma.merchant.create({ data: { userId, rawName: name, normalizedName: normalized } });
  }
  return merchant;
}

async function addTransaction(opts: {
  userId: string;
  accountId: string;
  date: Date;
  description: string;
  amountCents: number;
  type: "income" | "expense" | "transfer";
  isBusiness?: boolean;
  incomeSourceId?: string;
  businessEntityId?: string;
}) {
  const merchant = await getOrCreateMerchant(opts.userId, opts.description);
  let categoryId: string | null = null;
  let categorySource = "uncategorized";
  let categoryConfidence = 0;
  if (opts.type === "expense") {
    const result = await categorizeMerchant(opts.userId, opts.description);
    categoryId = result.categoryId;
    categorySource = result.source;
    categoryConfidence = result.confidence;
  }
  await prisma.transaction.create({
    data: {
      userId: opts.userId,
      accountId: opts.accountId,
      date: opts.date,
      description: opts.description,
      merchantId: merchant.id,
      categoryId,
      amountCents: opts.amountCents,
      type: opts.type,
      isTransfer: opts.type === "transfer",
      isBusiness: !!opts.isBusiness,
      incomeSourceId: opts.incomeSourceId,
      businessEntityId: opts.businessEntityId,
      categorySource,
      categoryConfidence,
    },
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding demo account...");
  const email = "demo@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists, wiping their data for a clean reseed...");
    await prisma.attachment.deleteMany({ where: { userId: existing.id } });
    await prisma.receipt.deleteMany({ where: { userId: existing.id } });
    await prisma.transactionSplit.deleteMany({ where: { transaction: { userId: existing.id } } });
    await prisma.transaction.deleteMany({ where: { userId: existing.id } });
    await prisma.statement.deleteMany({ where: { userId: existing.id } });
    await prisma.merchant.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.incomeSource.deleteMany({ where: { userId: existing.id } });
    await prisma.businessEntity.deleteMany({ where: { userId: existing.id } });
    await prisma.categoryRule.deleteMany({ where: { userId: existing.id } });
    await prisma.category.deleteMany({ where: { userId: existing.id, NOT: { parentId: null } } });
    await prisma.category.deleteMany({ where: { userId: existing.id } });
    await prisma.auditLog.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Demo User", isDemo: true },
  });

  await ensureCategoryTree(user.id);
  await seedSystemCategoryRules(user.id);

  const checking = await prisma.account.create({ data: { userId: user.id, name: "Everyday Checking", type: "checking", institution: "Demo Bank", isBusiness: false } });
  const savings = await prisma.account.create({ data: { userId: user.id, name: "High-Interest Savings", type: "savings", institution: "Demo Bank", isBusiness: false } });
  const credit = await prisma.account.create({ data: { userId: user.id, name: "Rewards Credit Card", type: "credit_card", institution: "Demo Bank", isBusiness: false } });
  const bizChecking = await prisma.account.create({ data: { userId: user.id, name: "Consulting Business Account", type: "checking", institution: "Demo Bank", isBusiness: true } });

  const salarySource = await prisma.incomeSource.create({ data: { userId: user.id, name: "Acme Corp Salary", type: "salary" } });
  const consultingSource = await prisma.incomeSource.create({ data: { userId: user.id, name: "Freelance Consulting", type: "consulting", isBusiness: true } });
  const tradingSource = await prisma.incomeSource.create({ data: { userId: user.id, name: "Investment Trading Gains", type: "trading" } });

  const bizEntity = await prisma.businessEntity.create({ data: { userId: user.id, name: "Demo Consulting LLC" } });

  // ~3 months (90 days) of realistic seed data
  const restaurants = ["Starbucks", "Tim Hortons", "Chipotle", "Subway", "McDonald's", "Local Sushi Bar", "Pizza Nova"];
  const groceries = ["Costco", "Walmart", "Loblaws", "Metro", "No Frills"];
  const shopping = ["Amazon", "Best Buy", "IKEA", "Apple Store"];

  for (let week = 0; week < 13; week++) {
    const weekStartDaysAgo = week * 7;

    // Bi-weekly salary (every other week)
    if (week % 2 === 0) {
      await addTransaction({
        userId: user.id, accountId: checking.id, date: daysAgo(weekStartDaysAgo + 1),
        description: "Acme Corp Payroll Deposit", amountCents: 320000, type: "income", incomeSourceId: salarySource.id,
      });
    }

    // Weekly groceries
    await addTransaction({
      userId: user.id, accountId: credit.id, date: daysAgo(weekStartDaysAgo + 2),
      description: groceries[week % groceries.length], amountCents: -(6500 + (week % 4) * 1200), type: "expense",
    });

    // A few restaurant visits per week
    for (let r = 0; r < 3; r++) {
      await addTransaction({
        userId: user.id, accountId: credit.id, date: daysAgo(weekStartDaysAgo + r + 1),
        description: restaurants[(week + r) % restaurants.length], amountCents: -(1200 + (r * 400)), type: "expense",
      });
    }

    // Transportation
    await addTransaction({
      userId: user.id, accountId: credit.id, date: daysAgo(weekStartDaysAgo + 3),
      description: "Shell", amountCents: -6000, type: "expense",
    });
    if (week % 2 === 1) {
      await addTransaction({
        userId: user.id, accountId: credit.id, date: daysAgo(weekStartDaysAgo + 4),
        description: "Uber", amountCents: -2400, type: "expense",
      });
    }

    // Occasional shopping
    if (week % 3 === 0) {
      await addTransaction({
        userId: user.id, accountId: credit.id, date: daysAgo(weekStartDaysAgo + 5),
        description: shopping[week % shopping.length], amountCents: -(4500 + week * 300), type: "expense",
      });
    }

    // Consulting income roughly every 3 weeks, business account
    if (week % 3 === 1) {
      await addTransaction({
        userId: user.id, accountId: bizChecking.id, date: daysAgo(weekStartDaysAgo + 2),
        description: "Consulting Client Invoice Payment", amountCents: 250000, type: "income",
        isBusiness: true, incomeSourceId: consultingSource.id, businessEntityId: bizEntity.id,
      });
      await addTransaction({
        userId: user.id, accountId: bizChecking.id, date: daysAgo(weekStartDaysAgo + 3),
        description: "Adobe Software Subscription", amountCents: -5499, type: "expense",
        isBusiness: true, businessEntityId: bizEntity.id,
      });
    }

    // Trading gains occasionally
    if (week % 4 === 2) {
      await addTransaction({
        userId: user.id, accountId: savings.id, date: daysAgo(weekStartDaysAgo + 6),
        description: "Brokerage Trading Gain Transfer", amountCents: 45000, type: "income", incomeSourceId: tradingSource.id,
      });
    }
  }

  // Monthly recurring bills for 3 months
  for (let m = 0; m < 3; m++) {
    const base = m * 30;
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 1), description: "Skyline Apartments Rent", amountCents: -220000, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 2), description: "Toronto Hydro", amountCents: -8500, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 2), description: "Enbridge Gas", amountCents: -4200, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 3), description: "Rogers Wireless", amountCents: -9500, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 3), description: "Bell Internet", amountCents: -7999, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 5), description: "Netflix Subscription", amountCents: -1699, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 5), description: "Spotify Subscription", amountCents: -1099, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 6), description: "GoodLife Fitness Membership", amountCents: -6499, type: "expense" });
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 7), description: "Manulife Home Insurance", amountCents: -11000, type: "expense" });

    // Transfer between own accounts (should be excluded from expense totals)
    await addTransaction({ userId: user.id, accountId: checking.id, date: daysAgo(base + 10), description: "Transfer to Savings", amountCents: -50000, type: "transfer" });
    await addTransaction({ userId: user.id, accountId: savings.id, date: daysAgo(base + 10), description: "Transfer from Checking", amountCents: 50000, type: "transfer" });
  }

  const txCount = await prisma.transaction.count({ where: { userId: user.id } });
  console.log(`Seed complete. Demo user: ${email} / demo1234. Transactions created: ${txCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
