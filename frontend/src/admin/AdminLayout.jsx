// 📄 frontend/src/admin/AdminLayout.jsx
import React from "react";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div style={{ display: "flex" }}>
      <AdminSidebar />

      <div style={{ padding: 30, flex: 1, background: "#f3f4f6", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}
