import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import accountsRouter from "./routes/accounts";
import transactionsRouter from "./routes/transactions";
import categoriesRouter from "./routes/categories";
import incomeRouter from "./routes/income";
import dashboardRouter from "./routes/dashboard";
import analyticsRouter from "./routes/analytics";
import statementsRouter from "./routes/statements";
import receiptsRouter from "./routes/receipts";
import nlqRouter from "./routes/nlq";
import { requireAuth, AuthedRequest } from "./middleware/auth";
import { prisma } from "./db";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/income", incomeRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/statements", statementsRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/nlq", nlqRouter);

app.get("/api/audit-log", requireAuth, async (req: AuthedRequest, res) => {
  const logs = await prisma.auditLog.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ logs });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, () => {
  console.log(`Finance dashboard API listening on http://localhost:${port}`);
});
