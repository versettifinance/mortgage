import React, { useEffect, useState } from "react";
import { api, formatMoney } from "../lib/api";

export default function Income() {
  const [sources, setSources] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("salary");
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [s, a] = await Promise.all([api.get("/income/sources"), api.get("/income/analytics")]);
    setSources(s.sources);
    setAnalytics(a);
  }

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/income/sources", { name, type, isBusiness });
    setShowForm(false);
    setName("");
    load();
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this income source?")) return;
    await api.del(`/income/sources/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Income</div>
          <div className="page-subtitle">Sources and year-to-date totals, computed from your transactions.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add source</button>
      </div>

      {analytics && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="stat-label">YTD Total Income ({analytics.year})</div>
          <div className="stat-value" style={{ fontSize: 30 }}>{formatMoney(analytics.ytdTotalCents)}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Income by source (YTD)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Source</th><th>Transactions</th><th>Total</th></tr></thead>
            <tbody>
              {analytics?.items.map((i: any) => (
                <tr key={i.incomeSourceId ?? "unassigned"}>
                  <td>{i.name}</td>
                  <td>{i.count}</td>
                  <td className="amount income">{formatMoney(i.totalCents)}</td>
                </tr>
              ))}
              {analytics?.items.length === 0 && <tr><td colSpan={3} className="empty-state">No income recorded this year yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Manage sources</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Business</th><th></th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{s.type}</td>
                  <td>{s.isBusiness ? "Yes" : "No"}</td>
                  <td><button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => deleteSource(s.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">New income source</div>
            <form onSubmit={createSource}>
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="salary">Salary</option>
                  <option value="consulting">Consulting</option>
                  <option value="trading">Trading</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
                <label style={{ marginBottom: 0 }}>Business income</label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
