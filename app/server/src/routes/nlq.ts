import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { answerQuery } from "../lib/nlq";

const router = Router();
router.use(requireAuth);

router.post("/", async (req: AuthedRequest, res) => {
  const { query } = req.body ?? {};
  if (!query || typeof query !== "string") return res.status(400).json({ error: "query string is required" });
  const result = await answerQuery(req.userId!, query);
  res.json(result);
});

export default router;
