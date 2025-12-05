import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  User,
  Mail,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  Eye,
  TrendingUp,
} from "lucide-react";
import AdminLayout from "../AdminLayout";
import { getAllOwners, deleteOwnerAdmin } from "../../api/api";

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [deleteModal, setDeleteModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Safe helpers for IDs and char codes (avoid runtime errors when id isn't a string)
  const safeId = (id) => {
    if (id === undefined || id === null) return "unknown-id";
    if (typeof id === "string") return id.slice(0, 12);
    if (typeof id === "number") return String(id);
    if (typeof id === "object") {
      // Common mongo wrappers: { _id: "..." } or { $oid: "..." }
      if (id.$oid) return String(id.$oid).slice(0, 12);
      if (id._id) return String(id._id).slice(0, 12);
      // fallback stringify
      try {
        return JSON.stringify(id).slice(0, 12);
      } catch {
        return String(id).slice(0, 12);
      }
    }
    return String(id).slice(0, 12);
  };

  const safeCharCode = (val) => {
    if (val === undefined || val === null) return 0;
    const s = typeof val === "string" ? val : String(val);
    return s.charCodeAt(0) || 0;
  };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllOwners();
      if (!res?.error) setOwners(res || []);
      else setOwners([]);
    } catch (err) {
      showToast("Failed to load owners", "error");
      setOwners([]);
    } finally {
      setLoading(false);
    }
  };

  const removeOwner = async (id) => {
    const originalOwners = owners;
    const optimisticOwners = owners.filter((o) => o.id !== id);
    setOwners(optimisticOwners);
    setDeleteModal(null);

    try {
      await deleteOwnerAdmin(id);
      showToast("Owner deleted successfully", "success");
    } catch (err) {
      setOwners(originalOwners);
      showToast("Failed to delete owner", "error");
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const filteredOwners = useMemo(() => {
    let result = owners || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.username?.toLowerCase().includes(q) ||
          o.email?.toLowerCase().includes(q) ||
          o.phone?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "all") {
      result = result.filter((o) => o.verification_status === filterStatus);
    }

    return result;
  }, [owners, searchQuery, filterStatus]);

  const exportCSV = () => {
    const headers = ["Username", "Email", "Phone", "Status", "Stations", "Last Active"];
    const rows = filteredOwners.map((o) => [
      o.username || "",
      o.email || "",
      o.phone || "",
      o.verification_status || "pending",
      o.stations_count || 0,
      o.last_active ? new Date(o.last_active).toLocaleDateString() : "Never",
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `owners-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully", "success");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "verified":
        return "var(--accent2)";
      case "pending":
        return "var(--accent)";
      case "rejected":
        return "var(--danger)";
      default:
        return "var(--muted)";
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setViewMode("table");
      else if (window.innerWidth >= 768) setViewMode("list");
      else setViewMode("cards");
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <AdminLayout title="Station Owners">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        .skeleton {
          background: linear-gradient(90deg, var(--glass) 0%, rgba(255,255,255,0.08) 50%, var(--glass) 100%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg, #0f1724)",
          color: "#fff",
          padding: "16px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          :root {
            --bg: #0f1724;
            --card: #0b1220;
            --muted: #94a3b8;
            --accent: #06b6d4;
            --accent2: #22c55e;
            --danger: #ef4444;
            --glass: rgba(255,255,255,0.04);
          }
        `}</style>

        <header style={{ animation: "slideIn 0.6s ease-out", marginBottom: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <h1
                style={{
                  fontSize: "clamp(28px, 5vw, 42px)",
                  fontWeight: "700",
                  margin: "0 0 8px 0",
                  background: "linear-gradient(135deg, #fff 0%, var(--muted) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Station Owners
              </h1>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>
                Manage and monitor all registered station owners
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 240px" }}>
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search owners..."
                  value={searchQuery}
                  onChange={handleSearch}
                  aria-label="Search owners"
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 40px",
                    background: "var(--card)",
                    border: "1px solid var(--glass)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass)")}
                />
              </div>

              <div style={{ position: "relative" }}>
                <Filter
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Filter by status"
                  style={{
                    padding: "10px 12px 10px 40px",
                    background: "var(--card)",
                    border: "1px solid var(--glass)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    cursor: "pointer",
                    outline: "none",
                    minWidth: "140px",
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh owners list"
                style={{
                  padding: "10px 16px",
                  background: "var(--glass)",
                  border: "1px solid var(--glass)",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                Refresh
              </button>

              <button
                onClick={exportCSV}
                disabled={filteredOwners.length === 0}
                aria-label="Export to CSV"
                style={{
                  padding: "10px 16px",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: filteredOwners.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                  opacity: filteredOwners.length === 0 ? 0.5 : 1,
                }}
                onMouseEnter={(e) => filteredOwners.length > 0 && (e.currentTarget.style.background = "#0891b2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>
        </header>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
              gap: "16px",
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: "var(--card)",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid var(--glass)",
                }}
              >
                <div className="skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%", marginBottom: "16px" }} />
                <div className="skeleton" style={{ width: "70%", height: "20px", borderRadius: "4px", marginBottom: "8px" }} />
                <div className="skeleton" style={{ width: "90%", height: "16px", borderRadius: "4px", marginBottom: "16px" }} />
                <div className="skeleton" style={{ width: "40%", height: "24px", borderRadius: "12px" }} />
              </div>
            ))}
          </div>
        ) : filteredOwners.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 20px",
              textAlign: "center",
              animation: "fadeIn 0.4s ease",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                background: "var(--glass)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <User size={48} style={{ color: "var(--muted)" }} />
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "20px" }}>No owners found</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 24px 0" }}>
              {searchQuery || filterStatus !== "all" ? "Try adjusting your search or filters" : "Get started by adding your first station owner"}
            </p>
            {(searchQuery || filterStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
                style={{
                  padding: "10px 20px",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div
            style={{
              background: "var(--card)",
              borderRadius: "12px",
              border: "1px solid var(--glass)",
              overflow: "hidden",
              animation: "fadeIn 0.4s ease",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--glass)", borderBottom: "1px solid var(--glass)" }}>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Owner</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Contact</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Status</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Stations</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Last Active</th>
                    <th style={{ padding: "16px", textAlign: "right", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOwners.map((owner, index) => (
                    <tr
                      key={safeId(owner.id)}
                      style={{
                        borderBottom: "1px solid var(--glass)",
                        transition: "background 0.2s ease",
                        animation: `fadeIn 0.3s ease ${index * 0.05}s backwards`,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glass)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "600",
                            flexShrink: 0,
                          }}>
                            {owner.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div style={{ fontWeight: "500" }}>{owner.username || "Unknown"}</div>
                            <div style={{ fontSize: "12px", color: "var(--muted)" }}>ID: {safeId(owner.id)}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ fontSize: "14px" }}>{owner.email || "—"}</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>{owner.phone || "No phone"}</div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "500",
                          background: `${getStatusColor(owner.verification_status)}20`,
                          color: getStatusColor(owner.verification_status),
                        }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: getStatusColor(owner.verification_status) }} />
                          {owner.verification_status || "pending"}
                        </span>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "600" }}>{owner.stations_count || 0}</span>
                          <TrendingUp size={14} style={{ color: "var(--accent2)" }} />
                        </div>
                      </td>

                      <td style={{ padding: "16px", fontSize: "14px", color: "var(--muted)" }}>
                        {owner.last_active ? new Date(owner.last_active).toLocaleDateString() : "Never"}
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            aria-label="View owner details"
                            style={{
                              padding: "8px",
                              background: "var(--glass)",
                              border: "none",
                              borderRadius: "6px",
                              color: "var(--accent)",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                          >
                            <Eye size={16} />
                          </button>

                          <a
                            href={`mailto:${owner.email}`}
                            aria-label="Send email"
                            style={{
                              padding: "8px",
                              background: "var(--glass)",
                              border: "none",
                              borderRadius: "6px",
                              color: "var(--accent2)",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              alignItems: "center",
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                          >
                            <Mail size={16} />
                          </a>

                          <button
                            onClick={() => setDeleteModal(owner)}
                            aria-label="Delete owner"
                            style={{
                              padding: "8px",
                              background: "var(--glass)",
                              border: "none",
                              borderRadius: "6px",
                              color: "var(--danger)",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
              gap: "16px",
            }}
          >
            {filteredOwners.map((owner, index) => (
              <article
                key={safeId(owner.id)}
                style={{
                  background: "var(--card)",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid var(--glass)",
                  transition: "all 0.3s ease",
                  animation: `scaleIn 0.3s ease ${index * 0.05}s backwards`,
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: "600",
                    flexShrink: 0,
                  }}>
                    {owner.username?.[0]?.toUpperCase() || "?"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {owner.username || "Unknown"}
                    </h3>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "13px", marginBottom: "8px" }}>
                      <Mail size={12} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{owner.email || "No email"}</span>
                    </div>

                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "500", background: `${getStatusColor(owner.verification_status)}20`, color: getStatusColor(owner.verification_status) }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: getStatusColor(owner.verification_status) }} />
                      {owner.verification_status || "pending"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", padding: "12px", background: "var(--glass)", borderRadius: "8px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", marginBottom: "4px" }}>Stations</div>
                    <div style={{ fontSize: "20px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                      {owner.stations_count || 0}
                      <TrendingUp size={14} style={{ color: "var(--accent2)" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", marginBottom: "4px" }}>Last Active</div>
                    <div style={{ fontSize: "13px", fontWeight: "500" }}>
                      {owner.last_active ? new Date(owner.last_active).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}
                    </div>
                  </div>
                </div>

                <svg width="100%" height="32" style={{ marginBottom: "16px" }}>
                  <defs>
                    <linearGradient id={`grad-${safeId(owner.id)}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: "var(--accent2)", stopOpacity: 0.3 }} />
                    </linearGradient>
                  </defs>
                  <polyline
                    points={[0,1,2,3,4,5,6,7,8,9,10,11].map((_, i) => {
                      const x = (i / 11) * 100;
                      const y = 16 + Math.sin(i * 0.5 + safeCharCode(owner.id)) * 10;
                      return `${x}%,${y}`;
                    }).join(" ")}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    style={{ vectorEffect: "non-scaling-stroke" }}
                  />
                </svg>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    aria-label="View owner details"
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "var(--glass)",
                      border: "1px solid var(--glass)",
                      borderRadius: "8px",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <Eye size={14} />
                    View
                  </button>

                  <a
                    href={`mailto:${owner.email}`}
                    aria-label="Send email to owner"
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "var(--glass)",
                      border: "1px solid var(--glass)",
                      borderRadius: "8px",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      transition: "all 0.2s ease",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                  >
                    <Mail size={14} />
                    Message
                  </a>

                  <button
                    onClick={() => setDeleteModal(owner)}
                    aria-label="Delete owner"
                    style={{
                      padding: "10px 14px",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "8px",
                      color: "var(--danger)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                      e.currentTarget.style.borderColor = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {deleteModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 1000,
              animation: "fadeIn 0.2s ease",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setDeleteModal(null)}
          >
            <div
              style={{
                background: "var(--card)",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "400px",
                width: "100%",
                border: "1px solid var(--glass)",
                animation: "scaleIn 0.3s ease",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDeleteModal(null)}
                aria-label="Close modal"
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  padding: "8px",
                  background: "var(--glass)",
                  border: "none",
                  borderRadius: "6px",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--glass)";
                  e.currentTarget.style.color = "var(--muted)";
                }}
              >
                <X size={16} />
              </button>

              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <AlertCircle size={28} style={{ color: "var(--danger)" }} />
              </div>

              <h3 id="delete-modal-title" style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "600" }}>
                Delete Owner?
              </h3>

              <p style={{ margin: "0 0 24px 0", color: "var(--muted)", fontSize: "14px", lineHeight: "1.5" }}>
                Are you sure you want to delete <strong style={{ color: "#fff" }}>{deleteModal.username}</strong>? This action cannot be undone and will permanently remove all associated data.
              </p>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setDeleteModal(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "var(--glass)",
                    border: "1px solid var(--glass)",
                    borderRadius: "8px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--glass)")}
                >
                  Cancel
                </button>

                <button
                  onClick={() => removeOwner(deleteModal.id)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "var(--danger)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#dc2626")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--danger)")}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  Delete Owner
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              background: "var(--card)",
              border: `1px solid ${toast.type === "success" ? "var(--accent2)" : "var(--danger)"}`,
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              animation: "slideIn 0.3s ease",
              zIndex: 1001,
              maxWidth: "calc(100vw - 48px)",
            }}
          >
            {toast.type === "success" ? <CheckCircle size={20} style={{ color: "var(--accent2)", flexShrink: 0 }} /> : <AlertCircle size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />}
            <span style={{ fontSize: "14px", fontWeight: "500" }}>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              aria-label="Close notification"
              style={{ padding: "4px", background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", marginLeft: "8px", flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
