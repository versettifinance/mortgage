import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { api, formatMoney } from "../lib/api";
import RangePicker from "../components/RangePicker";

const COLORS = ["#0f9d78", "#0d7a9e", "#c8862c", "#8a63d2", "#d1657a", "#4f9ede", "#7fb069", "#e0a94c", "#9c6644", "#5e6472"];

export default function Dashboard() {
  const [range, setRange] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [range, from, to]);

  async function load() {
    setLoading(true);
    const q = `range=${range}${range === "custom" ? `&from=${from}&to=${to}` : ""}`;
    const [s, sot] = await Promise.all([
      api.get(`/dashboard/summary?${q}`),
      api.get(`/dashboard/spending-over-time?${q}`),
    ]);
    setSummary(s);
    setSeries(sot.series);
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Real-time snapshot of your finances, computed from stored transactions.</div>
        </div>
        <RangePicker value={range} onChange={setRange} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      {loading || !summary ? (
        <div className="empty-state">Loading dashboard…</div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Income" value={formatMoney(summary.incomeCents)} pct={summary.changeVsPrevious.incomePct} />
            <StatTile label="Expenses" value={formatMoney(summary.expenseCents)} pct={summary.changeVsPrevious.expensePct} invert />
            <StatTile label="Net Cash Flow" value={formatMoney(summary.netCents)} pct={summary.changeVsPrevious.netPct} />
            <div className="card stat-tile">
              <div className="stat-label">Personal vs Business</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {formatMoney(summary.personalExpenseCents)} <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>/</span> {formatMoney(summary.businessExpenseCents)}
              </div>
              <div className="stat-change">Personal / Business expense split</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 16, alignItems: "start" }}>
            <div className="card">
              <div className="section-title">Spending by category</div>
              {summary.categoryBreakdown.length === 0 ? (
                <div className="empty-state">No expenses in this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={summary.categoryBreakdown} dataKey="totalCents" nameKey="categoryName" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {summary.categoryBreakdown.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatMoney(v as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card">
              <div className="section-title">Key insights</div>
              {summary.insights.length === 0 ? (
                <div className="empty-state">Not enough data yet for insights.</div>
              ) : (
                <ul className="insight-list">
                  {summary.insights.map((s: string, i: number) => (
                    <li key={i}>💡 {s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Income vs expenses over time</div>
            {series.length === 0 ? (
              <div className="empty-state">No data in this range.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                  <Tooltip formatter={(v: any) => formatMoney(v as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="incomeCents" name="Income" stroke="#0f9d78" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenseCents" name="Expenses" stroke="#d1657a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, pct, invert }: { label: string; value: string; pct: number | null; invert?: boolean }) {
  const up = pct !== null && pct >= 0;
  const good = invert ? !up : up;
  return (
    <div className="card stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {pct !== null && (
        <div className={`stat-change ${good ? "up" : "down"}`}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs previous period
        </div>
      )}
    </div>
  );
}
