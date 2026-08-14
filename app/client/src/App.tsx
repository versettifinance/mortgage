import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Transactions from "./pages/Transactions";
import Income from "./pages/Income";
import Categories from "./pages/Categories";
import Statements from "./pages/Statements";
import StatementReview from "./pages/StatementReview";
import Receipts from "./pages/Receipts";
import AnalyticsPage from "./pages/Analytics";
import ComingSoon from "./pages/ComingSoon";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty-state">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/:id" element={<AccountDetail />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/income" element={<Income />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/statements" element={<Statements />} />
                  <Route path="/statements/:id" element={<StatementReview />} />
                  <Route path="/receipts" element={<Receipts />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/bills" element={<ComingSoon title="Bills & Recurring" />} />
                  <Route path="/budgets" element={<ComingSoon title="Budgets" />} />
                  <Route path="/networth" element={<ComingSoon title="Net Worth" />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
