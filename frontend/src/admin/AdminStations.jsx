// 📄 frontend/src/admin/AdminStations.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import {
  getPendingStations,
  approveStation,
  rejectStation,
} from "../api/api";

export default function AdminStations() {
  const [stations, setStations] = useState([]);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    const res = await getPendingStations();
    if (!res.error) setStations(res);
  };

  const handleApprove = async (id) => {
    await approveStation(id);
    loadPending();
  };

  const handleReject = async (id) => {
    if (!rejectReason) return alert("Enter rejection reason");
    await rejectStation(id, rejectReason);
    setRejectReason("");
    loadPending();
  };

  return (
    <AdminLayout>
      <h1>🚉 Pending Station Approvals</h1>

      {stations.length === 0 ? (
        <p>No pending stations.</p>
      ) : (
        stations.map((s) => (
          <div key={s.id} style={{
            background: "white", padding: 18, marginBottom: 14,
            borderRadius: 12, boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <h3>{s.name}</h3>
            <p>{s.location}</p>
            <p>Owner: {s.owner_name} ({s.owner_email})</p>

            <button
              onClick={() => handleApprove(s.id)}
              style={{
                padding: "8px 14px", background: "#10b981",
                color: "white", border: "none", borderRadius: 8,
                marginRight: 10,
              }}
            >
              Approve
            </button>

            <input
              placeholder="Reject Reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
            />

            <button
              onClick={() => handleReject(s.id)}
              style={{
                padding: "8px 14px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 8,
                marginLeft: 10,
              }}
            >
              Reject
            </button>
          </div>
        ))
      )}
    </AdminLayout>
  );
}
