import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Statements() {
  const [statements, setStatements] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    api.get("/accounts").then((d) => { setAccounts(d.accounts); setAccountId(d.accounts[0]?.id ?? ""); });
  }, []);

  async function load() {
    const d = await api.get("/statements");
    setStatements(d.statements);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("accountId", accountId);
      fd.append("file", file);
      await api.post("/statements/upload", fd);
      setFile(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Statement Import</div>
          <div className="page-subtitle">Upload a CSV bank/credit-card statement to auto-categorize and reconcile transactions.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Upload CSV</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -6, marginBottom: 14 }}>
          Expected columns (case-insensitive, any order): <code>Date</code>, <code>Description</code>, <code>Amount</code>
          (negative = expense, positive = income), or separate <code>Debit</code>/<code>Credit</code> columns.
          Optional <code>Type</code> column (income/expense/transfer).
        </p>
        <form onSubmit={upload}>
          <div className="grid grid-2">
            <div className="field">
              <label>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>CSV file</label>
              <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload & analyze"}</button>
        </form>
      </div>

      <div className="card">
        <div className="section-title">Import history</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>File</th><th>Status</th><th>Imported</th><th>Categorized</th><th>Needs review</th><th>Duplicates</th><th></th></tr></thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id}>
                  <td>{s.filename}</td>
                  <td style={{ textTransform: "capitalize" }}>{s.status}</td>
                  <td>{s.importedCount}</td>
                  <td>{s.categorizedCount}</td>
                  <td>{s.needsReviewCount}</td>
                  <td>{s.duplicateCount}</td>
                  <td><Link className="btn" style={{ padding: "5px 9px" }} to={`/statements/${s.id}`}>Review</Link></td>
                </tr>
              ))}
              {statements.length === 0 && <tr><td colSpan={7} className="empty-state">No statements imported yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
