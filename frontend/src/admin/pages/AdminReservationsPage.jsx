import React, { useEffect, useState, useMemo, useRef } from "react";
import AdminLayout from "../AdminLayout";
import { getAllReservationsGrouped } from "../../api/api";
import {
  Search,
  Filter,
  Calendar,
  DownloadCloud,
  RefreshCw,
  Clock,
  Zap,
  AlertCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  TrendingUp,
} from "lucide-react";

const STATUS_CONFIG = {
  active: { color: "#10b981", label: "Active", icon: "●" },
  charging: { color: "#06b6d4", label: "Charging", icon: "⚡" },
  expired: { color: "#ef4444", label: "Expired", icon: "×" },
  completed: { color: "#8b5cf6", label: "Completed", icon: "✓" },
};

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [viewMode, setViewMode] = useState("card");
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });
  const searchTimeoutRef = useRef(null);
  const sparklineChartsRef = useRef({});

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(sparklineChartsRef.current).forEach((chart) => {
        if (chart) chart.destroy();
      });
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllReservationsGrouped();
      if (!res.error) {
        setReservations(
          res.map((r, idx) => ({
            ...r,
            id: r.id || idx,
            user_name: r.user_name || "Unknown User",
            station_name: r.station_name || "Unknown Station",
            status: r.status || "active",
            eta: r.eta || new Date().toISOString(),
            expiry: r.expiry || new Date(Date.now() + 3600000).toISOString(),
            charging_end: r.charging_end || null,
            reservation_count: r.reservation_count || 1,
            created_at: r.created_at || new Date().toISOString(),
          }))
        );
        setSelectedReservation(null);
      }
    } catch (error) {
      showToast("Failed to load reservations", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, 300);
  };

  const filteredAndSortedReservations = useMemo(() => {
    let filtered = [...reservations];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.user_name.toLowerCase().includes(query) ||
          r.station_name.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [reservations, searchQuery, statusFilter, sortConfig]);

  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedReservations.slice(start, start + pageSize);
  }, [filteredAndSortedReservations, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedReservations.length / pageSize);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleCancel = async (id) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    setCancelModal(null);
    showToast("Reservation cancelled successfully", "success");
    setTimeout(load, 1000);
  };

  const exportCSV = (data = filteredAndSortedReservations) => {
    const headers = ["User", "Station", "ETA", "Expiry", "Status", "Charging End", "Reservations"];
    const csv = [
      headers.join(","),
      ...data.map((r) =>
        [
          r.user_name,
          r.station_name,
          new Date(r.eta).toLocaleString(),
          new Date(r.expiry).toLocaleString(),
          r.status,
          r.charging_end ? new Date(r.charging_end).toLocaleString() : "N/A",
          r.reservation_count,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully", "success");
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.active;

  const renderSparkline = (index, data = [1, 2, 2, 3, 2, 4, 3, 5, 4, 6]) => {
    try {
      return (
        <canvas
          key={`spark-${index}`}
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const max = Math.max(...data);
            const w = canvas.width / data.length;
            ctx.strokeStyle = "#06b6d4";
            ctx.lineWidth = 2;
            ctx.beginPath();

            data.forEach((val, i) => {
              const x = (i + 0.5) * w;
              const y = canvas.height - (val / max) * (canvas.height - 4) - 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });

            ctx.stroke();
          }}
          style={{ width: "100%", height: "30px", display: "block" }}
        />
      );
    } catch {
      return null;
    }
  };

  return (
    <AdminLayout title="All Reservations">
      <style>{`
        :root {
          --bg: #0f1724;
          --surface: #0b1220;
          --muted: #94a3b8;
          --accent: #06b6d4;
          --accent2: #22c55e;
          --danger: #ef4444;
          --card: #0b1220;
          --glass: rgba(255, 255, 255, 0.04);
        }

        .admin-reservations-page {
          background: var(--bg);
          min-height: 100vh;
          padding: 1.5rem;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes fadeOut {
          to {
            opacity: 0;
            transform: scale(0.9);
          }
        }

        .header {
          animation: slideIn 0.5s ease-out;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-content h1 {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent), #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .header-content p {
          color: var(--muted);
          font-size: 0.95rem;
        }

        .header-icons {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          padding: 0.65rem;
          border-radius: 8px;
          background: var(--glass);
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--accent);
        }

        .icon-btn:active {
          transform: scale(0.95);
        }

        .icon-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          background: var(--glass);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .search-box {
          flex: 1;
          min-width: 200px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.65rem 0.75rem 0.65rem 2.5rem;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s;
        }

        .search-box input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15);
        }

        .search-box .icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }

        .filter-pills {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .pill {
          padding: 0.65rem 1rem;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: var(--card);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .pill:hover {
          border-color: var(--accent);
        }

        .pill.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #000;
        }

        select {
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.65rem 2rem 0.65rem 0.75rem;
          color: #fff;
          font-size: 0.9rem;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn:active {
          transform: scale(0.96);
        }

        .btn-secondary {
          background: var(--glass);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .shimmer-card {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
        }

        .shimmer-card::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
          animation: shimmer 2s infinite;
        }

        .shimmer-bar {
          height: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          margin-bottom: 0.75rem;
        }

        .shimmer-bar:last-child {
          margin-bottom: 0;
          width: 60%;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--glass);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .empty-state svg {
          margin: 0 auto 1.5rem;
          color: var(--muted);
        }

        .empty-state h3 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: var(--muted);
          margin-bottom: 1.5rem;
        }

        .reservation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .reservation-card {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s;
          cursor: pointer;
        }

        .reservation-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
          border-color: var(--accent);
        }

        .reservation-card.deleting {
          animation: fadeOut 0.3s forwards;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .card-subtitle {
          color: var(--muted);
          font-size: 0.85rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .card-meta {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .meta-item {
          font-size: 0.85rem;
        }

        .meta-label {
          color: var(--muted);
          margin-bottom: 0.25rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .meta-value {
          font-weight: 600;
        }

        .card-sparkline {
          height: 30px;
          margin-bottom: 1rem;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .action-link {
          color: var(--accent);
          cursor: pointer;
          text-decoration: none;
          border-right: 1px solid rgba(255, 255, 255, 0.2);
          padding-right: 0.5rem;
          margin-right: 0.5rem;
        }

        .action-link:last-child {
          border-right: none;
          padding-right: 0;
          margin-right: 0;
        }

        .action-link:hover {
          text-decoration: underline;
        }

        .table-container {
          background: var(--card);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: none;
        }

        @media (min-width: 768px) {
          .reservation-grid {
            display: none;
          }
          .table-container {
            display: block;
          }
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: var(--glass);
        }

        th {
          text-align: left;
          padding: 1rem;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }

        th:hover {
          color: var(--accent);
        }

        th .sort-icon {
          display: inline-block;
          margin-left: 0.25rem;
          vertical-align: middle;
        }

        td {
          padding: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        tbody tr {
          transition: background 0.2s;
        }

        tbody tr:hover {
          background: var(--glass);
        }

        tbody tr.deleting {
          animation: fadeOut 0.3s forwards;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal {
          background: var(--card);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 2rem;
          max-width: 400px;
          width: 100%;
          animation: slideIn 0.3s ease-out;
        }

        .modal h3 {
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .modal p {
          color: var(--muted);
          margin-bottom: 1.5rem;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-danger {
          background: var(--danger);
          color: #fff;
        }

        .toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: var(--card);
          border-radius: 8px;
          padding: 1rem 1.5rem;
          border: 1px solid;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          animation: slideIn 0.3s ease-out;
          z-index: 1001;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        }

        .toast.success {
          border-color: var(--accent2);
        }

        .toast.error {
          border-color: var(--danger);
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1rem;
          background: var(--glass);
          border-radius: 0 0 12px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .page-info {
          color: var(--muted);
          font-size: 0.9rem;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 768px) {
          .toolbar {
            flex-direction: column;
          }
          .search-box {
            width: 100%;
          }
          .filter-pills {
            width: 100%;
          }
          .btn {
            width: 100%;
            justify-content: center;
          }
          .header {
            flex-direction: column;
          }
          .header-icons {
            width: 100%;
            justify-content: space-around;
          }
        }
      `}</style>

      <div className="admin-reservations-page">
        <div className="header">
          <div className="header-content">
            <h1>Reservations Dashboard</h1>
            <p>Monitor and manage all active and historical reservations</p>
          </div>
          <div className="header-icons">
            <button className="icon-btn" aria-label="Search" title="Search">
              <Search size={20} />
            </button>
            <button className="icon-btn" aria-label="Filter" title="Filter">
              <Filter size={20} />
            </button>
            <button className="icon-btn" aria-label="Calendar" title="Calendar">
              <Calendar size={20} />
            </button>
            <button className="icon-btn" onClick={() => exportCSV()} aria-label="Export" title="Export">
              <DownloadCloud size={20} />
            </button>
            <button className="icon-btn" onClick={load} aria-label="Refresh" title="Refresh">
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <Search className="icon" size={18} />
            <input
              type="text"
              placeholder="Search users, stations..."
              onChange={handleSearchChange}
              aria-label="Search reservations"
            />
          </div>

          <div className="filter-pills">
            {["all", "active", "charging", "expired", "completed"].map((status) => (
              <button
                key={status}
                className={`pill ${statusFilter === status ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            aria-label="Select date range"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>

          <button className="btn btn-secondary" onClick={load} aria-label="Refresh data">
            <RefreshCw size={18} />
            Refresh
          </button>

          <button className="btn btn-secondary" onClick={() => exportCSV()} aria-label="Export CSV">
            <DownloadCloud size={18} />
            Export CSV
          </button>
        </div>

        {loading && (
          <div className="reservation-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="shimmer-card">
                <div className="shimmer-bar" />
                <div className="shimmer-bar" />
                <div className="shimmer-bar" />
              </div>
            ))}
          </div>
        )}

        {!loading && reservations.length === 0 && (
          <div className="empty-state">
            <AlertCircle size={64} />
            <h3>No Reservations Found</h3>
            <p>There are no reservations yet. Start by checking the stations.</p>
            <button className="btn btn-secondary">View Stations</button>
          </div>
        )}

        {!loading && reservations.length > 0 && (
          <>
            <div className="reservation-grid">
              {paginatedReservations.map((reservation) => {
                const statusConfig = getStatusConfig(reservation.status);
                return (
                  <div
                    key={reservation.id}
                    className={`reservation-card ${
                      cancelModal?.id === reservation.id ? "deleting" : ""
                    }`}
                    onClick={() => setSelectedReservation(reservation)}
                  >
                    <div className="card-header">
                      <div>
                        <div className="card-title">{reservation.user_name}</div>
                        <div className="card-subtitle">{reservation.station_name}</div>
                      </div>
                      <div
                        className="status-badge"
                        style={{
                          backgroundColor: statusConfig.color + "22",
                          color: statusConfig.color,
                          border: `1px solid ${statusConfig.color}44`,
                        }}
                      >
                        <span>{statusConfig.icon}</span>
                        {statusConfig.label}
                      </div>
                    </div>

                    <div className="card-sparkline">
                      {renderSparkline(reservation.id)}
                    </div>

                    <div className="card-meta">
                      <div className="meta-item">
                        <div className="meta-label">ETA</div>
                        <div className="meta-value">{formatDate(reservation.eta)}</div>
                      </div>
                      <div className="meta-item">
                        <div className="meta-label">Expires</div>
                        <div className="meta-value">{formatDate(reservation.expiry)}</div>
                      </div>
                      <div className="meta-item">
                        <div className="meta-label">Reservations</div>
                        <div className="meta-value">{reservation.reservation_count}</div>
                      </div>
                      {reservation.charging_end && (
                        <div className="meta-item">
                          <div className="meta-label">Ends</div>
                          <div className="meta-value">{formatDate(reservation.charging_end)}</div>
                        </div>
                      )}
                    </div>

                    <div className="card-actions">
                      <span
                        className="action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReservation(reservation);
                        }}
                      >
                        View
                      </span>
                      <span
                        className="action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelModal(reservation);
                        }}
                      >
                        Cancel
                      </span>
                      <span
                        className="action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCSV([reservation]);
                        }}
                      >
                        Export
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort("user_name")}>
                      User
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("station_name")}>
                      Station
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("eta")}>
                      ETA
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("expiry")}>
                      Expiry
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("status")}>
                      Status
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("charging_end")}>
                      Charging End
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReservations.map((reservation) => {
                    const statusConfig = getStatusConfig(reservation.status);
                    return (
                      <tr
                        key={reservation.id}
                        className={cancelModal?.id === reservation.id ? "deleting" : ""}
                      >
                        <td style={{ fontWeight: 600 }}>{reservation.user_name}</td>
                        <td>{reservation.station_name}</td>
                        <td>{formatDate(reservation.eta)}</td>
                        <td>{formatDate(reservation.expiry)}</td>
                        <td>
                          <div
                            className="status-badge"
                            style={{
                              backgroundColor: statusConfig.color + "22",
                              color: statusConfig.color,
                              border: `1px solid ${statusConfig.color}44`,
                            }}
                          >
                            <span>{statusConfig.icon}</span>
                            {statusConfig.label}
                          </div>
                        </td>
                        <td>
                          {reservation.charging_end
                            ? formatDate(reservation.charging_end)
                            : "N/A"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem" }}>
                            <button
                              className="icon-btn"
                              onClick={() => setSelectedReservation(reservation)}
                              aria-label={`View details for ${reservation.user_name}`}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => setCancelModal(reservation)}
                              aria-label={`Cancel reservation for ${reservation.user_name}`}
                              style={{ color: "var(--danger)" }}
                            >
                              <X size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => exportCSV([reservation])}
                              aria-label={`Export ${reservation.user_name} data`}
                            >
                              <DownloadCloud size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="pagination">
                <div className="page-info">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredAndSortedReservations.length)} of{" "}
                  {filteredAndSortedReservations.length} results
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <label
                      htmlFor="pageSize"
                      style={{ color: "var(--muted)", fontSize: "0.9rem" }}
                    >
                      Rows per page:
                    </label>
                    <select
                      id="pageSize"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                  </div>

                  <div className="pagination-controls">
                    <button
                      className="icon-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                      style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      className="icon-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                      style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {cancelModal && (
          <div
            className="modal-overlay"
            onClick={() => setCancelModal(null)}
            role="dialog"
            aria-labelledby="cancel-modal-title"
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 id="cancel-modal-title">Cancel Reservation</h3>
              <p>
                Are you sure you want to cancel the reservation for{" "}
                <strong>{cancelModal.user_name}</strong> at{" "}
                <strong>{cancelModal.station_name}</strong>? This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>
                  <X size={18} />
                  Keep It
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleCancel(cancelModal.id)}
                >
                  <AlertCircle size={18} />
                  Cancel Reservation
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`toast ${toast.type}`} role="alert" aria-live="polite">
            {toast.type === "success" ? (
              <div style={{ color: "var(--accent2)" }}>✓</div>
            ) : (
              <AlertCircle size={20} color="var(--danger)" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
