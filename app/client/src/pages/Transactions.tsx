import React, { useEffect, useState } from "react";
import { api, formatMoney, formatDate, getToken } from "../lib/api";

interface Filters {
  search: string;
  categoryId: string;
  accountId: string;
  isBusiness: string;
  type: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
}

const emptyFilters: Filters = { search: "", categoryId: "", accountId: "", isBusiness: "", type: "", minAmount: "", maxAmount: "", dateFrom: "", dateTo: "" };

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showForm, setShowForm] = useState<any | null>(null); // null = closed, {} = new, obj = edit
  const [splitFor, setSplitFor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/accounts"), api.get("/categories")]).then(([a, c]) => {
      setAccounts(a.accounts);
      setCategories(c.categories);
    });
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.accountId) params.set("accountId", filters.accountId);
    if (filters.isBusiness) params.set("isBusiness", filters.isBusiness);
    if (filters.type) params.set("type", filters.type);
    if (filters.minAmount) params.set("minAmount", String(Math.round(parseFloat(filters.minAmount) * 100)));
    if (filters.maxAmount) params.set("maxAmount", String(Math.round(parseFloat(filters.maxAmount) * 100)));
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    const d = await api.get(`/transactions?${params.toString()}`);
    setTransactions(d.transactions);
    setLoading(false);
  }

  async function deleteTx(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await api.del(`/transactions/${id}`);
    load();
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.accountId) params.set("accountId", filters.accountId);
    if (filters.isBusiness) params.set("isBusiness", filters.isBusiness);
    if (filters.type) params.set("type", filters.type);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    fetch(`/api/transactions/export/csv?${params.toString()}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "transactions_export.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-subtitle">Search, filter, and manage every transaction.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportCsv}>⇩ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowForm({})}>+ Add transaction</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-4">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Search merchant/description</label>
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="e.g. Starbucks" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Account</label>
            <select value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
              <option value="">All</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Personal/Business</label>
            <select value={filters.isBusiness} onChange={(e) => setFilters({ ...filters, isBusiness: e.target.value })}>
              <option value="">All</option>
              <option value="false">Personal</option>
              <option value="true">Business</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Min amount ($)</label>
            <input type="number" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Max amount ($)</label>
            <input type="number" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Date from</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Date to</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setFilters(emptyFilters)}>Clear filters</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th><th></th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>
                    {t.description}
                    {t.isBusiness && <span className="badge business" style={{ marginLeft: 6 }}>Business</span>}
                    {t.splits?.length > 0 && <span className="badge" style={{ marginLeft: 6 }}>Split</span>}
                  </td>
                  <td>{t.category?.name ?? "Uncategorized"}</td>
                  <td>{t.account?.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{t.type}</td>
                  <td className={`amount ${t.amountCents >= 0 ? "income" : "expense"}`}>{formatMoney(t.amountCents)}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn" style={{ padding: "5px 9px" }} onClick={() => setShowForm(t)}>Edit</button>
                    <button className="btn" style={{ padding: "5px 9px" }} onClick={() => setSplitFor(t)}>Split</button>
                    <button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => deleteTx(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={7} className="empty-state">No transactions match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm !== null && (
        <TransactionForm
          tx={showForm}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); }}
        />
      )}
      {splitFor && (
        <SplitModal tx={splitFor} onClose={() => setSplitFor(null)} onSaved={() => { setSplitFor(null); load(); }} />
      )}
    </div>
  );
}

function TransactionForm({ tx, accounts, categories, onClose, onSaved }: any) {
  const isEdit = !!tx.id;
  const [accountId, setAccountId] = useState(tx.accountId || accounts[0]?.id || "");
  const [date, setDate] = useState(tx.date ? tx.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(tx.description || "");
  const [amount, setAmount] = useState(tx.amountCents ? (Math.abs(tx.amountCents) / 100).toFixed(2) : "");
  const [type, setType] = useState(tx.type || "expense");
  const [categoryId, setCategoryId] = useState(tx.categoryId || "");
  const [isBusiness, setIsBusiness] = useState(!!tx.isBusiness);
  const [notes, setNotes] = useState(tx.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const sign = type === "income" ? 1 : -1;
      const amountCents = type === "transfer" ? Math.round(parseFloat(amount) * 100) : sign * Math.round(parseFloat(amount) * 100);
      const payload = { accountId, date, description, amountCents, type, isBusiness, categoryId: categoryId || null, notes };
      if (isEdit) await api.put(`/transactions/${tx.id}`, payload);
      else await api.post("/transactions", payload);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{isEdit ? "Edit transaction" : "Add transaction"}</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Description / Merchant</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div className="field">
              <label>Amount ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
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
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SplitModal({ tx, onClose, onSaved }: any) {
  const total = Math.abs(tx.amountCents) / 100;
  const [personal, setPersonal] = useState((total / 2).toFixed(2));
  const [business, setBusiness] = useState((total / 2).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = Math.round(parseFloat(personal) * 100);
    const b = Math.round(parseFloat(business) * 100);
    if (p + b !== Math.abs(tx.amountCents)) {
      setError(`Split must total ${(Math.abs(tx.amountCents) / 100).toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      const sign = tx.amountCents < 0 ? -1 : 1;
      await api.post(`/transactions/${tx.id}/splits`, {
        splits: [
          { label: "Personal", amountCents: sign * p, isBusiness: false },
          { label: "Business", amountCents: sign * b, isBusiness: true },
        ],
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Split "{tx.description}" ({formatMoney(tx.amountCents)})</div>
        <form onSubmit={submit}>
          <div className="grid grid-2">
            <div className="field">
              <label>Personal ($)</label>
              <input type="number" step="0.01" value={personal} onChange={(e) => setPersonal(e.target.value)} />
            </div>
            <div className="field">
              <label>Business ($)</label>
              <input type="number" step="0.01" value={business} onChange={(e) => setBusiness(e.target.value)} />
            </div>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save split"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
