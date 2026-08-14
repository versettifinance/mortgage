import React, { useState } from "react";
import { api } from "../lib/api";

export default function NlqBar() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await api.post("/nlq", { query });
      setAnswer(res.answer);
    } catch (err: any) {
      setAnswer(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <form onSubmit={ask}>
        <input
          placeholder='Ask: "How much did I spend at Starbucks?"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => answer && setOpen(true)}
        />
      </form>
      {open && (answer || loading) && (
        <div
          className="card"
          style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 50, whiteSpace: "pre-line", fontSize: 13.5 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>{loading ? "Thinking through your data…" : answer}</div>
            <button className="btn" style={{ padding: "2px 8px" }} onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
