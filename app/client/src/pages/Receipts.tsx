import React, { useEffect, useState } from "react";
import { createWorker } from "tesseract.js";
import { api, formatMoney } from "../lib/api";

function extractFields(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find currency-looking numbers, e.g. 12.99, $12.99, 1,234.56
  const moneyRegex = /\$?\s?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})/g;
  let bestTotal: number | null = null;
  let bestScore = -1;
  for (const line of lines) {
    const lower = line.toLowerCase();
    let match: RegExpExecArray | null;
    moneyRegex.lastIndex = 0;
    while ((match = moneyRegex.exec(line))) {
      const value = parseFloat(match[0].replace(/[$,\s]/g, ""));
      let score = value; // larger currency-looking numbers preferred as tiebreak
      if (lower.includes("total") && !lower.includes("subtotal")) score += 100000;
      else if (lower.includes("subtotal")) score -= 500;
      else if (lower.includes("tax")) score -= 1000;
      if (score > bestScore) {
        bestScore = score;
        bestTotal = value;
      }
    }
  }

  // Date: look for common date patterns
  const dateRegex = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
  let date: string | null = null;
  for (const line of lines) {
    const m = line.match(dateRegex);
    if (m) { date = m[1]; break; }
  }

  // Merchant: assume it's one of the first non-empty lines that isn't just numbers/symbols
  let merchant: string | null = null;
  for (const line of lines.slice(0, 6)) {
    if (line.length > 2 && !/^\d+$/.test(line) && !moneyRegex.test(line)) {
      merchant = line;
      break;
    }
  }

  return { merchant, date, total: bestTotal };
}

export default function Receipts() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.get("/accounts"), api.get("/categories")]).then(([a, c]) => {
      setAccounts(a.accounts);
      setAccountId(a.accounts[0]?.id ?? "");
      setCategories(c.categories);
    });
  }, []);

  function onFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function runOcr() {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    try {
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => { if (m.status === "recognizing text") setProgress(m.progress); },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setOcrText(data.text);
      const extracted = extractFields(data.text);
      setMerchant(extracted.merchant ?? "");
      setTotal(extracted.total ? extracted.total.toFixed(2) : "");
      if (extracted.date) {
        const parts = extracted.date.split(/[\/\-.]/);
        if (parts.length === 3) {
          let [a, b, y] = parts;
          if (y.length === 2) y = "20" + y;
          // assume M/D/Y for North American receipts
          const guess = `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
          setDate(!isNaN(Date.parse(guess)) ? guess : new Date().toISOString().slice(0, 10));
        }
      } else {
        setDate(new Date().toISOString().slice(0, 10));
      }
      setReviewing(true);
    } finally {
      setProcessing(false);
    }
  }

  async function confirm() {
    if (!file) return;
    setConfirming(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("ocrText", ocrText);
      fd.append("extractedMerchant", merchant);
      fd.append("extractedDate", date);
      fd.append("extractedTotalCents", String(Math.round(parseFloat(total || "0") * 100)));
      const r = await api.post("/receipts", fd);
      const tx = await api.post(`/receipts/${r.receipt.id}/confirm`, {
        accountId, merchant, date, totalCents: Math.round(parseFloat(total) * 100), isBusiness, categoryId: categoryId || undefined,
      });
      setResult(tx.transaction);
      setReviewing(false);
      onFileChange(null);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Receipt Scanner</div>
          <div className="page-subtitle">OCR runs entirely in your browser via tesseract.js — no data leaves your device until you confirm.</div>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
          Transaction created: {result.description} — {formatMoney(result.amountCents)}
        </div>
      )}

      {!reviewing && (
        <div className="card">
          <div className="field">
            <label>Capture or upload a receipt image</label>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
          </div>
          {preview && <img src={preview} alt="preview" style={{ maxWidth: 260, borderRadius: 10, marginBottom: 12 }} />}
          <button className="btn btn-primary" onClick={runOcr} disabled={!file || processing}>
            {processing ? `Scanning… ${(progress * 100).toFixed(0)}%` : "Run OCR & extract fields"}
          </button>
        </div>
      )}

      {reviewing && (
        <div className="card">
          <div className="section-title">Review extracted fields before confirming</div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -6, marginBottom: 14 }}>
            OCR is heuristic — please verify merchant, date, and total before creating a transaction.
          </p>
          <div className="grid grid-2">
            <div className="field">
              <label>Merchant</label>
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Total ($)</label>
              <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div className="field">
              <label>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Auto-categorize</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
              <label style={{ marginBottom: 0 }}>Business expense</label>
            </div>
          </div>
          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--text-muted)" }}>Raw OCR text</summary>
            <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>{ocrText}</pre>
          </details>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setReviewing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={confirming || !merchant || !total}>
              {confirming ? "Creating…" : "Confirm & create transaction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
