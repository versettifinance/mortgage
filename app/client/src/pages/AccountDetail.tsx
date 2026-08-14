import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatMoney, formatDate } from "../lib/api";

export default function AccountDetail() {
  const { id } = useParams();
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (id) api.get(`/accounts/${id}/transactions`).then((d) => { setAccount(d.account); setTransactions(d.transactions); });
  }, [id]);

  if (!account) return <div className="empty-state">Loading…</div>;

  const balance = transactions.reduce((s, t) => s + t.amountCents, 0);

  return (
    <div>
      <Link to="/accounts" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Accounts</Link>
      <div className="page-header" style={{ marginTop: 8 }}>
        <div>
          <div className="page-title">{account.name}</div>
          <div className="page-subtitle">{account.institution || "—"} · {account.type.replace("_", " ")}</div>
        </div>
        <div className={`amount ${balance >= 0 ? "income" : "expense"}`} style={{ fontSize: 24 }}>{formatMoney(balance)}</div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td>{t.category?.name ?? "Uncategorized"}</td>
                  <td className={`amount ${t.amountCents >= 0 ? "income" : "expense"}`}>{formatMoney(t.amountCents)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No transactions in this account yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
