import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney } from "../lib/api";

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const d = await api.get("/accounts");
    setAccounts(d.accounts);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/accounts", { name, type, institution, isBusiness });
    setShowForm(false);
    setName(""); setInstitution(""); setIsBusiness(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Accounts</div>
          <div className="page-subtitle">Balances derived from real transaction history.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add account</button>
      </div>

      <div className="grid grid-3">
        {accounts.map((a) => (
          <Link key={a.id} to={`/accounts/${a.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{a.institution || "—"} · {a.type.replace("_", " ")}</div>
              </div>
              {a.isBusiness && <span className="badge business">Business</span>}
            </div>
            <div className={`amount ${a.balanceCents >= 0 ? "income" : "expense"}`} style={{ fontSize: 22, marginTop: 14 }}>
              {formatMoney(a.balanceCents)}
            </div>
          </Link>
        ))}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">New account</div>
            <form onSubmit={createAccount}>
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit card</option>
                  <option value="investment">Investment</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="field">
                <label>Institution</label>
                <input value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </div>
              <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
                <label style={{ marginBottom: 0 }}>Business account</label>
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
