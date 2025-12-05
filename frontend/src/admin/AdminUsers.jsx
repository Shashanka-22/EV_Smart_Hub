// 📄 frontend/src/admin/AdminUsers.jsx
import React from "react";
import AdminLayout from "./AdminLayout";

export default function AdminUsers() {
  return (
    <AdminLayout>
      <h1>🚨 Flagged / Suspicious Users</h1>

      <div
        style={{
          padding: 20,
          background: "white",
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          marginTop: 20,
        }}
      >
        <h2 style={{ marginBottom: 10 }}>🚧 Feature Coming Soon</h2>
        <p style={{ fontSize: 16, color: "#555" }}>
          User-flagging and abuse monitoring is not yet implemented in backend.
        </p>
      </div>
    </AdminLayout>
  );
}
