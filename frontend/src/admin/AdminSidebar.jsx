// 📄 frontend/src/admin/AdminSidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart2,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  CreditCard,
} from "lucide-react";

export default function AdminSidebar() {
  const location = useLocation();

  const links = [
    { path: "/super-admin", label: "Dashboard", icon: BarChart2 },
    { path: "/super-admin/stations", label: "Station Approvals", icon: CheckCircle },
    { path: "/super-admin/refunds", label: "Refund Logs", icon: CreditCard },
    { path: "/super-admin/users", label: "Flagged Users", icon: Users },
    { path: "/super-admin/performance", label: "Station Performance", icon: TrendingUp },
  ];

  return (
    <div style={{
      width: 250,
      background: "#1f2937",
      color: "white",
      minHeight: "100vh",
      padding: 20,
    }}>
      <h2 style={{ marginBottom: 20 }}>⚡ Admin Panel</h2>

      {links.map((l) => {
        const Icon = l.icon;
        const active = location.pathname === l.path;

        return (
          <Link
            key={l.path}
            to={l.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              marginBottom: 10,
              borderRadius: 8,
              textDecoration: "none",
              color: active ? "#38bdf8" : "white",
              background: active ? "#111827" : "transparent",
            }}
          >
            <Icon size={18} />
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
