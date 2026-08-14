import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatMoney, formatDate } from "../lib/api";

export default function StatementReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [statement, setStatement] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filterFlagged, setFilterFlagged] = useState(false);

  useEffect(() => { load(); api.get("/categories").then((d) => setCategories(d.categories)); }, [id]);

  async function load() {
    const d = await api.get(`/statements/${id}`);
    setStatement(d.statement);
    setTransactions(d.transactions);
  }

  async function updateCategory(txId: string, categoryId: string) {
    await api.put(`/transactions/${txId}`, { categoryId });
    load();
  }

  async function deleteTx(txId: string) {
    await api.del(`/transactions/${txId}`);
    load();
  }

  async function commit() {
    await api.post(`/statements/${id}/commit`);
    navigate("/statements");
  }

  if (!statement) return <div className="empty-state">Loading…</div>;

  const shown = filterFlagged ? transactions.filter((t) => t.needsReview || t.isDuplicate) : transactions;

  return (
    <div>
      <Link to="/statements" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Statements</Link>
      <div className="page-header" style={{ marginTop: 8 }}>
        <div>
          <div className="page-title">Reconciliation: {statement.filename}</div>
          <div className="page-subtitle">
            {statement.importedCount} imported, {statement.categorizedCount} categorized, {statement.needsReviewCount} need review, {statement.duplicateCount} possible duplicates
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" style={filterFlagged ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}} onClick={() => setFilterFlagged((f) => !f)}>
            {filterFlagged ? "Showing flagged only" : "Show flagged only"}
          </button>
          <button className="btn btn-primary" onClick={commit} disabled={statement.status === "committed"}>
            {statement.status === "committed" ? "Committed" : "Approve & commit import"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Flags</th><th></th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td className={`amount ${t.amountCents >= 0 ? "income" : "expense"}`}>{formatMoney(t.amountCents)}</td>
                  <td>
                    <select value={t.categoryId ?? ""} onChange={(e) => updateCategory(t.id, e.target.value)} style={{ width: "auto" }}>
                      <option value="">Uncategorized</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    {t.needsReview && <span className="badge review" style={{ marginRight: 4 }}>Review</span>}
                    {t.isDuplicate && <span className="badge review">Possible duplicate</span>}
                    {!t.needsReview && !t.isDuplicate && <span className="badge">{t.categorySource}</span>}
                  </td>
                  <td><button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => deleteTx(t.id)}>Remove</button></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="empty-state">Nothing to show.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
