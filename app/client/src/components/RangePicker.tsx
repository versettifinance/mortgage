import React from "react";

export const RANGE_OPTIONS = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "ytd", label: "YTD" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

export default function RangePicker({
  value,
  onChange,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  value: string;
  onChange: (v: string) => void;
  from?: string;
  to?: string;
  onFromChange?: (v: string) => void;
  onToChange?: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "auto" }}>
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value === "custom" && (
        <>
          <input type="date" value={from} onChange={(e) => onFromChange?.(e.target.value)} style={{ width: "auto" }} />
          <span style={{ color: "var(--text-muted)" }}>to</span>
          <input type="date" value={to} onChange={(e) => onToChange?.(e.target.value)} style={{ width: "auto" }} />
        </>
      )}
    </div>
  );
}
