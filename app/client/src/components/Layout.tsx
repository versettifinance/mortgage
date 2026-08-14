import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import NlqBar from "./NlqBar";

const NAV = [
  { section: "Overview", items: [
    { to: "/", label: "Dashboard", icon: "◈" },
    { to: "/accounts", label: "Accounts", icon: "▤" },
    { to: "/transactions", label: "Transactions", icon: "≡" },
    { to: "/income", label: "Income", icon: "↑" },
    { to: "/analytics", label: "Analytics", icon: "◔" },
  ]},
  { section: "Manage", items: [
    { to: "/categories", label: "Categories", icon: "▦" },
    { to: "/statements", label: "Statement Import", icon: "⇩" },
    { to: "/receipts", label: "Receipt Scanner", icon: "▣" },
  ]},
  { section: "Phase 2", items: [
    { to: "/bills", label: "Bills & Recurring", icon: "⏱" },
    { to: "/budgets", label: "Budgets", icon: "◎" },
    { to: "/networth", label: "Net Worth", icon: "▲" },
  ]},
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">W</span>
          Wealthline
        </div>
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                onClick={() => setNavOpen(false)}
              >
                <span>{item.icon}</span> {item.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button className="nav-link" onClick={() => { logout(); navigate("/login"); }}>
            ← Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <button className="hamburger btn" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
            ☰
          </button>
          <div style={{ flex: 1, maxWidth: 620, margin: "0 16px" }}>
            <NlqBar />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.name}</span>
            <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
        <div className="page">
          {user?.isDemo && (
            <div className="demo-banner">This is a seeded demo account (demo@example.com) — all data shown is sample data for demonstration.</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
