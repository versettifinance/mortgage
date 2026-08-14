import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Categories() {
  const [tree, setTree] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const [c, r] = await Promise.all([api.get("/categories"), api.get("/categories/rules")]);
    setTree(c.tree);
    setRules(r.rules);
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/categories", { name, parentId: parentId || null });
    setShowForm(false);
    setName("");
    load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    try {
      await api.del(`/categories/${id}`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this learned rule?")) return;
    await api.del(`/categories/rules/${id}`);
    load();
  }

  const learned = rules.filter((r) => r.source === "user_learned");
  const system = rules.filter((r) => r.source === "system_default");

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Categories</div>
          <div className="page-subtitle">Manage the category tree and categorization rules.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add category</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {tree.map((t) => (
          <div key={t.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              {!t.isSystem && <button className="btn btn-danger" style={{ padding: "3px 8px" }} onClick={() => deleteCategory(t.id)}>Delete</button>}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {t.children.map((c: any) => (
                <span key={c.id} className="chip" style={{ cursor: "default" }}>
                  {c.name}
                  {!c.isSystem && <span onClick={() => deleteCategory(c.id)} style={{ cursor: "pointer", color: "var(--danger)" }}> ✕</span>}
                </span>
              ))}
              {t.children.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No subcategories</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Learned rules ({learned.length})</div>
        <p className="page-subtitle" style={{ marginTop: -6, marginBottom: 12 }}>
          Created automatically when you manually recategorize a transaction. These take precedence over system defaults for future imports.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Merchant pattern</th><th>Category</th><th>Confidence</th><th></th></tr></thead>
            <tbody>
              {learned.map((r) => (
                <tr key={r.id}>
                  <td>{r.merchantPattern}</td>
                  <td>{r.category.name}</td>
                  <td>{(r.confidence * 100).toFixed(0)}%</td>
                  <td><button className="btn btn-danger" style={{ padding: "5px 9px" }} onClick={() => deleteRule(r.id)}>Delete</button></td>
                </tr>
              ))}
              {learned.length === 0 && <tr><td colSpan={4} className="empty-state">No learned rules yet — recategorize a transaction to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">System default rules ({system.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Merchant pattern</th><th>Category</th><th>Confidence</th></tr></thead>
            <tbody>
              {system.map((r) => (
                <tr key={r.id}><td>{r.merchantPattern}</td><td>{r.category.name}</td><td>{(r.confidence * 100).toFixed(0)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">New category</div>
            <form onSubmit={createCategory}>
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Parent (leave blank for top-level)</label>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Top-level category</option>
                  {tree.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
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
