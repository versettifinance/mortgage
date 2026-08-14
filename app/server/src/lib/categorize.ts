import { prisma } from "../db";

// Normalize a raw merchant/description string: lowercase, strip store codes,
// trailing numbers, punctuation, common POS noise.
export function normalizeMerchant(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/[#*]\d+/g, " "); // strip #1234 / *1234 store codes
  s = s.replace(/\b\d{3,}\b/g, " "); // strip long trailing numeric codes
  s = s.replace(/\b(pos|debit|credit|purchase|payment|pmt|xxx+\d*|ref\s?\d+)\b/g, " ");
  s = s.replace(/[^a-z0-9&' ]/g, " "); // strip punctuation
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Keyword fallback map: keyword -> category path (top > sub)
const KEYWORD_RULES: { keyword: string; top: string; sub: string }[] = [
  { keyword: "grocery", top: "Food", sub: "Groceries" },
  { keyword: "market", top: "Food", sub: "Groceries" },
  { keyword: "restaurant", top: "Food", sub: "Restaurants" },
  { keyword: "cafe", top: "Food", sub: "Restaurants" },
  { keyword: "coffee", top: "Food", sub: "Restaurants" },
  { keyword: "pizza", top: "Food", sub: "Restaurants" },
  { keyword: "sushi", top: "Food", sub: "Restaurants" },
  { keyword: "uber", top: "Transportation", sub: "Rideshare" },
  { keyword: "lyft", top: "Transportation", sub: "Rideshare" },
  { keyword: "taxi", top: "Transportation", sub: "Rideshare" },
  { keyword: "gas", top: "Transportation", sub: "Fuel" },
  { keyword: "fuel", top: "Transportation", sub: "Fuel" },
  { keyword: "parking", top: "Transportation", sub: "Parking" },
  { keyword: "transit", top: "Transportation", sub: "Public Transit" },
  { keyword: "airline", top: "Transportation", sub: "Travel" },
  { keyword: "hotel", top: "Transportation", sub: "Travel" },
  { keyword: "rent", top: "Housing", sub: "Rent" },
  { keyword: "mortgage", top: "Housing", sub: "Mortgage" },
  { keyword: "hydro", top: "Utilities", sub: "Electricity" },
  { keyword: "electric", top: "Utilities", sub: "Electricity" },
  { keyword: "water", top: "Utilities", sub: "Water" },
  { keyword: "internet", top: "Utilities", sub: "Internet" },
  { keyword: "phone", top: "Utilities", sub: "Phone" },
  { keyword: "wireless", top: "Utilities", sub: "Phone" },
  { keyword: "insurance", top: "Financial", sub: "Insurance" },
  { keyword: "bank fee", top: "Financial", sub: "Fees" },
  { keyword: "interest", top: "Financial", sub: "Interest" },
  { keyword: "invest", top: "Financial", sub: "Investments" },
  { keyword: "subscription", top: "Lifestyle", sub: "Subscriptions" },
  { keyword: "gym", top: "Lifestyle", sub: "Fitness" },
  { keyword: "fitness", top: "Lifestyle", sub: "Fitness" },
  { keyword: "pharmacy", top: "Lifestyle", sub: "Health" },
  { keyword: "clinic", top: "Lifestyle", sub: "Health" },
  { keyword: "shop", top: "Shopping", sub: "General Merchandise" },
  { keyword: "store", top: "Shopping", sub: "General Merchandise" },
  { keyword: "clothing", top: "Shopping", sub: "Clothing" },
];

// System default merchant -> category mappings (normalized merchant substring match)
export const SYSTEM_MERCHANT_RULES: { pattern: string; top: string; sub: string }[] = [
  { pattern: "costco", top: "Food", sub: "Groceries" },
  { pattern: "walmart", top: "Food", sub: "Groceries" },
  { pattern: "loblaws", top: "Food", sub: "Groceries" },
  { pattern: "sobeys", top: "Food", sub: "Groceries" },
  { pattern: "metro", top: "Food", sub: "Groceries" },
  { pattern: "no frills", top: "Food", sub: "Groceries" },
  { pattern: "whole foods", top: "Food", sub: "Groceries" },
  { pattern: "trader joe", top: "Food", sub: "Groceries" },
  { pattern: "starbucks", top: "Food", sub: "Restaurants" },
  { pattern: "mcdonald", top: "Food", sub: "Restaurants" },
  { pattern: "tim hortons", top: "Food", sub: "Restaurants" },
  { pattern: "subway", top: "Food", sub: "Restaurants" },
  { pattern: "chipotle", top: "Food", sub: "Restaurants" },
  { pattern: "doordash", top: "Food", sub: "Restaurants" },
  { pattern: "uber eats", top: "Food", sub: "Restaurants" },
  { pattern: "skip the dishes", top: "Food", sub: "Restaurants" },
  { pattern: "amazon", top: "Shopping", sub: "General Merchandise" },
  { pattern: "best buy", top: "Shopping", sub: "Electronics" },
  { pattern: "apple", top: "Shopping", sub: "Electronics" },
  { pattern: "ikea", top: "Shopping", sub: "Home Goods" },
  { pattern: "uber", top: "Transportation", sub: "Rideshare" },
  { pattern: "lyft", top: "Transportation", sub: "Rideshare" },
  { pattern: "shell", top: "Transportation", sub: "Fuel" },
  { pattern: "petro canada", top: "Transportation", sub: "Fuel" },
  { pattern: "esso", top: "Transportation", sub: "Fuel" },
  { pattern: "chevron", top: "Transportation", sub: "Fuel" },
  { pattern: "presto", top: "Transportation", sub: "Public Transit" },
  { pattern: "air canada", top: "Transportation", sub: "Travel" },
  { pattern: "westjet", top: "Transportation", sub: "Travel" },
  { pattern: "netflix", top: "Lifestyle", sub: "Subscriptions" },
  { pattern: "spotify", top: "Lifestyle", sub: "Subscriptions" },
  { pattern: "disney", top: "Lifestyle", sub: "Subscriptions" },
  { pattern: "amazon prime", top: "Lifestyle", sub: "Subscriptions" },
  { pattern: "goodlife", top: "Lifestyle", sub: "Fitness" },
  { pattern: "rogers", top: "Utilities", sub: "Phone" },
  { pattern: "bell", top: "Utilities", sub: "Phone" },
  { pattern: "telus", top: "Utilities", sub: "Phone" },
  { pattern: "freedom mobile", top: "Utilities", sub: "Phone" },
  { pattern: "toronto hydro", top: "Utilities", sub: "Electricity" },
  { pattern: "enbridge", top: "Utilities", sub: "Gas" },
  { pattern: "shoppers drug mart", top: "Lifestyle", sub: "Health" },
  { pattern: "rexall", top: "Lifestyle", sub: "Health" },
  { pattern: "lcbo", top: "Lifestyle", sub: "Alcohol" },
  { pattern: "beer store", top: "Lifestyle", sub: "Alcohol" },
];

export const CATEGORY_TREE: Record<string, string[]> = {
  Food: ["Groceries", "Restaurants"],
  Transportation: ["Rideshare", "Fuel", "Parking", "Public Transit", "Travel", "Auto Maintenance"],
  Housing: ["Rent", "Mortgage", "Home Insurance", "Maintenance"],
  Utilities: ["Electricity", "Water", "Gas", "Internet", "Phone"],
  Financial: ["Insurance", "Fees", "Interest", "Investments", "Taxes"],
  Lifestyle: ["Subscriptions", "Fitness", "Health", "Alcohol", "Entertainment", "Personal Care"],
  Shopping: ["General Merchandise", "Electronics", "Clothing", "Home Goods"],
  Income: ["Salary", "Consulting", "Trading", "Other Income"],
  Business: ["Software", "Office", "Contractors", "Business Travel", "Business Meals"],
  Transfers: ["Account Transfer"],
};

export async function ensureCategoryTree(userId: string) {
  const existing = await prisma.category.findMany({ where: { userId } });
  const byPath = new Map<string, string>();
  for (const c of existing) {
    const key = c.parentId ? `${c.parentId}::${c.name}` : `root::${c.name}`;
    byPath.set(key, c.id);
  }
  for (const [top, subs] of Object.entries(CATEGORY_TREE)) {
    let topId = byPath.get(`root::${top}`);
    if (!topId) {
      const created = await prisma.category.create({
        data: { userId, name: top, isSystem: true },
      });
      topId = created.id;
      byPath.set(`root::${top}`, topId);
    }
    for (const sub of subs) {
      const key = `${topId}::${sub}`;
      if (!byPath.has(key)) {
        const created = await prisma.category.create({
          data: { userId, name: sub, parentId: topId, isSystem: true },
        });
        byPath.set(key, created.id);
      }
    }
  }
}

export async function seedSystemCategoryRules(userId: string) {
  const categories = await prisma.category.findMany({ where: { userId } });
  const findSub = (top: string, sub: string) => {
    const parent = categories.find((c) => c.name === top && !c.parentId);
    if (!parent) return null;
    return categories.find((c) => c.name === sub && c.parentId === parent.id) ?? null;
  };
  for (const rule of SYSTEM_MERCHANT_RULES) {
    const cat = findSub(rule.top, rule.sub);
    if (!cat) continue;
    await prisma.categoryRule.upsert({
      where: { userId_merchantPattern_source: { userId, merchantPattern: rule.pattern, source: "system_default" } },
      update: { categoryId: cat.id },
      create: {
        userId,
        merchantPattern: rule.pattern,
        categoryId: cat.id,
        source: "system_default",
        confidence: 0.9,
      },
    });
  }
}

export interface CategorizationResult {
  categoryId: string | null;
  source: "user_learned" | "system_default" | "keyword_fallback" | "uncategorized";
  confidence: number;
}

// Categorize a merchant description against a user's rule set.
// user_learned rules always take precedence over system_default rules.
export async function categorizeMerchant(userId: string, rawDescription: string): Promise<CategorizationResult> {
  const normalized = normalizeMerchant(rawDescription);
  const rules = await prisma.categoryRule.findMany({ where: { userId } });

  const learned = rules
    .filter((r) => r.source === "user_learned" && normalized.includes(r.merchantPattern))
    .sort((a, b) => b.merchantPattern.length - a.merchantPattern.length)[0];
  if (learned) {
    return { categoryId: learned.categoryId, source: "user_learned", confidence: learned.confidence };
  }

  const system = rules
    .filter((r) => r.source === "system_default" && normalized.includes(r.merchantPattern))
    .sort((a, b) => b.merchantPattern.length - a.merchantPattern.length)[0];
  if (system) {
    return { categoryId: system.categoryId, source: "system_default", confidence: system.confidence };
  }

  // keyword fallback
  const kw = KEYWORD_RULES.find((k) => normalized.includes(k.keyword));
  if (kw) {
    const categories = await prisma.category.findMany({ where: { userId } });
    const parent = categories.find((c) => c.name === kw.top && !c.parentId);
    const cat = parent ? categories.find((c) => c.name === kw.sub && c.parentId === parent.id) : null;
    if (cat) {
      return { categoryId: cat.id, source: "keyword_fallback", confidence: 0.4 };
    }
  }

  return { categoryId: null, source: "uncategorized", confidence: 0 };
}

// Upsert a user_learned rule when a user manually recategorizes a transaction.
export async function learnFromCorrection(userId: string, rawDescription: string, categoryId: string) {
  const normalized = normalizeMerchant(rawDescription);
  // use the first significant token(s) as the pattern (up to 3 words) to keep it generalizable
  const pattern = normalized.split(" ").slice(0, 3).join(" ").trim();
  if (!pattern) return;
  await prisma.categoryRule.upsert({
    where: { userId_merchantPattern_source: { userId, merchantPattern: pattern, source: "user_learned" } },
    update: { categoryId, confidence: 0.95 },
    create: {
      userId,
      merchantPattern: pattern,
      categoryId,
      source: "user_learned",
      confidence: 0.95,
    },
  });
}
