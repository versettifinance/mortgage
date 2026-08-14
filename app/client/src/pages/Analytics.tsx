import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { api, formatMoney, formatDate } from "../lib/api";

const COLORS = ["#0f9d78", "#0d7a9e", "#c8862c", "#8a63d2", "#d1657a", "#4f9ede", "#7fb069", "#e0a94c", "#9c6644", "#5e6472"];

export default function AnalyticsPage() {
  const [drill, setDrill] = useState<{ level: string; items?: any[]; transactions?: any[] }>({ level: "categories" });
  const [path, setPath] = useState<{ label: string; categoryId?: string; merchantId?: string }[]>([]);
  const [pvb, setPvb] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    loadDrill();
    api.get("/analytics/personal-vs-business").then((d) => setPvb(d.rows));
    api.get("/dashboard/spending-over-time?range=last_6_months").then((d) => setSeries(d.series));
  }, []);

  async function loadDrill(categoryId?: string, merchantId?: string) {
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    if (merchantId) params.set("merchantId", merchantId);
    const d = await api.get(`/analytics/drilldown?${params.toString()}`);
    setDrill(d);
  }

  function drillInto(item: any) {
    if (drill.level === "categories" || drill.level === "subcategories") {
      setPath([...path, { label: item.name, categoryId: item.categoryId }]);
      loadDrill(item.categoryId ?? undefined);
    } else if (drill.level === "merchants") {
      setPath([...path, { label: item.name, merchantId: item.merchantId }]);
      loadDrill(undefined, item.merchantId);
    }
  }

  function goTo(index: number) {
    if (index === -1) { setPath([]); loadDrill(); return; }
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    const last = newPath[newPath.length - 1];
    loadDrill(last.categoryId, last.merchantId);
  }

  const businessExpense = pvb.find((r) => r.isBusiness && r.type === "expense")?.totalCents ?? 0;
  const personalExpense = pvb.find((r) => !r.isBusiness && r.type === "expense")?.totalCents ?? 0;
  const pvbChart = [
    { name: "Personal", value: personalExpense },
    { name: "Business", value: businessExpense },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-subtitle">Drill down from category to subcategory to merchant to individual transactions.</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start", marginBottom: 16 }}>
        <div className="card">
          <div className="section-title" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span onClick={() => goTo(-1)} style={{ cursor: "pointer", color: path.length ? "var(--accent)" : "inherit" }}>All categories</span>
            {path.map((p, i) => (
              <React.Fragment key={i}>
                <span style={{ color: "var(--text-faint)" }}>›</span>
                <span onClick={() => goTo(i)} style={{ cursor: "pointer", color: i === path.length - 1 ? "inherit" : "var(--accent)" }}>{p.label}</span>
              </React.Fragment>
            ))}
          </div>
          {drill.level === "transactions" ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  {(drill.transactions ?? []).map((t: any) => (
                    <tr key={t.id}><td>{formatDate(t.date)}</td><td>{t.description}</td><td className="amount expense">{formatMoney(t.amountCents)}</td></tr>
                  ))}
                  {(drill.transactions ?? []).length === 0 && <tr><td colSpan={3} className="empty-state">No transactions.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {(drill.items ?? []).map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => drillInto(item)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px",
                    borderRadius: 10, border: "1px solid var(--card-border)", background: "var(--bg)", cursor: "pointer", color: "var(--text)", width: "100%",
                  }}
                >
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(item.totalCents)}</span>
                </button>
              ))}
              {(drill.items ?? []).length === 0 && <div className="empty-state">No data.</div>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Personal vs Business expenses</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pvbChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                {pvbChart.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => formatMoney(v as number)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Spending over time (last 6 months)</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
            <Tooltip formatter={(v: any) => formatMoney(v as number)} />
            <Legend />
            <Bar dataKey="incomeCents" name="Income" fill="#0f9d78" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenseCents" name="Expenses" fill="#d1657a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
