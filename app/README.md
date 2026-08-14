# Wealthline — Personal Finance Intelligence Dashboard (Phase 1 MVP)

A full-stack personal finance dashboard: Node.js/Express/Prisma/SQLite backend, React/TypeScript/Vite frontend.
No external LLM APIs are used anywhere — categorization is a deterministic rule engine, natural-language
queries are handled by a lightweight intent parser against real Prisma aggregation queries, and receipt OCR
runs fully client-side in the browser via `tesseract.js`.

## Prerequisites

- Node.js 18+ (tested on Node 22)
- npm

## 1. Install dependencies

```bash
cd app/server && npm install
cd ../client && npm install
```

## 2. Configure environment

```bash
cd app/server
cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string, e.g.:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` is gitignored; `.env.example` documents the required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path (defaults to `file:./prisma/dev.db`) |
| `JWT_SECRET` | Secret used to sign JWT access tokens — required, no default |
| `JWT_EXPIRES_IN` | Access token lifetime, e.g. `2h` |
| `PORT` | API server port (default 4000) |
| `CLIENT_ORIGIN` | Allowed CORS origin for the Vite dev server |

## 3. Run migrations and seed demo data

```bash
cd app/server
npx prisma migrate dev
npm run seed
```

This creates `app/server/prisma/dev.db` (gitignored) and seeds a demo account:

- **Email:** `demo@example.com`
- **Password:** `demo1234`
- ~3 months (13 weeks) of realistic transactions across 4 accounts (checking, savings, credit card,
  a separate business checking account), income from salary/consulting/trading, expenses across
  groceries/restaurants/transport/shopping/utilities/housing/subscriptions, a personal/business mix,
  and inter-account transfers (correctly excluded from expense totals).

Re-running `npm run seed` is safe — it wipes and recreates only the demo user's data.

## 4. Run in development

Two processes, in two terminals:

```bash
# Terminal 1 — API server (http://localhost:4000)
cd app/server
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd app/client
npm run dev
```

Vite proxies `/api/*` to `http://localhost:4000`, so just open `http://localhost:5173` and log in with the
demo account (or register a new one — a fresh account gets the full category tree and system default
categorization rules seeded automatically, plus one starter account).

## Architecture

- **Backend**: Express + TypeScript, Prisma ORM over SQLite. JWT auth (bcrypt-hashed passwords, short-lived
  access tokens, secret from env — never hardcoded). All money is stored as **integer cents**; all
  totals/averages/percentages are computed via real Prisma aggregation queries against stored transactions —
  nothing is estimated or hardcoded.
- **Frontend**: React + TypeScript + Vite SPA, `react-router-dom` for client-side routing, `recharts` for
  charts, mobile-first responsive layout, light/dark theme via CSS variables with a toggle.
- **Categorization engine** (`app/server/src/lib/categorize.ts`): merchant names are normalized (lowercased,
  store codes and trailing numeric codes stripped). A `CategoryRule` table holds `system_default` rules
  (~40 common merchants shipped, e.g. Costco, Walmart, Amazon, Uber, Starbucks, Netflix, Shell, McDonald's,
  Rogers, Bell) and `user_learned` rules created automatically whenever a user manually recategorizes a
  transaction. `user_learned` rules always take precedence over `system_default` rules and are applied to
  all future transactions/imports for that merchant. Transactions that match neither fall back to keyword
  matching, then to "Uncategorized" — the system never fabricates a confidence score.
- **Natural-language query bar** (`app/server/src/lib/nlq.ts`): a regex/pattern-based intent parser — not an
  LLM — recognizes queries like "How much did I spend at Starbucks", "How much did I spend on groceries this
  month", "Biggest expenses this month", "Recurring expenses", and "What changed from June to July", turns
  them into Prisma aggregation queries, and returns an answer built from real numbers. Unparseable queries
  say so explicitly rather than guessing.
- **Receipt OCR** (`app/client/src/pages/Receipts.tsx`): `tesseract.js` runs entirely in the browser (works
  offline, no API key). Regex heuristics extract merchant/date/total (the largest currency-looking number
  near "total", excluding "subtotal"/"tax" lines) from the OCR text. The user reviews and can edit every
  field before confirming — nothing is written to the database from unreviewed OCR output.
- **Statement import**: CSV upload → parsed into transactions immediately tied to categorization results →
  a reconciliation review screen shows "N imported, N categorized, N need review, N possible duplicates" →
  the user can edit/delete/recategorize before clicking "Approve & commit". Rows containing "transfer" in
  the description are marked as transfers and excluded from expense totals. Duplicate detection flags rows
  with the same amount, a date within 1 day, and overlapping merchant text against existing transactions.

### Expected CSV import format

Columns are matched case-insensitively, in any order:

| Column | Required | Notes |
|---|---|---|
| `Date` | yes | Any format `Date.parse` accepts, e.g. `2026-08-01` |
| `Description` | yes | Merchant / memo text (also accepts `Merchant` or `Memo`) |
| `Amount` | yes* | Negative = expense, positive = income. Accepts `$` and `,` |
| `Debit` / `Credit` | alt. to `Amount` | Used if `Amount` is absent |
| `Type` | no | `income` / `expense` / `transfer` — inferred from sign and keywords if omitted |

## Data model

See `app/server/prisma/schema.prisma`. Implements: `User`, `Account`, `Transaction`, `TransactionSplit`
(personal/business allocation on a single transaction), `Category` (self-referential parent/child),
`Merchant`, `IncomeSource`, `Statement`, `Receipt`, `BusinessEntity`, `CategoryRule`, `Attachment`,
`AuditLog` (logs login, transaction create/update/delete, statement import, category correction).

## Phase 1 vs Phase 2

Everything in the "Phase 1 feature set" of the spec is implemented end-to-end with real data. Bills/Recurring,
Budgets, and Net Worth are visible in the nav under a "Phase 2" section as simple "coming soon" placeholders
with no fake numbers or interactions — the schema does not (yet) model them since the spec allowed the UI to
lag the schema for these.

## Known gaps vs. the full spec

- Camera capture on the receipt scanner uses the browser's native `<input capture>` — there's no custom
  in-page camera viewfinder.
- Duplicate detection during CSV import uses a pragmatic heuristic (amount + date within 1 day + overlapping
  merchant token), not a fuzzy-matching library.
- No PDF statement parsing (explicitly out of scope for Phase 1 per the spec).
- The production client bundle is a single ~650KB chunk (recharts + tesseract.js are the bulk of it); code
  splitting was left for a later pass since it doesn't affect functional correctness.
