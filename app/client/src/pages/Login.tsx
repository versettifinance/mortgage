import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) navigate("/");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 4 }}>
          <span className="brand-mark">W</span> Wealthline
        </div>
        <p className="page-subtitle" style={{ textAlign: "center", marginBottom: 20 }}>
          Personal Finance Intelligence Dashboard
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
          Demo account preloaded: demo@example.com / demo1234
        </p>
        <p style={{ fontSize: 13, textAlign: "center", marginTop: 10 }}>
          No account? <Link to="/register" style={{ color: "var(--accent)" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
