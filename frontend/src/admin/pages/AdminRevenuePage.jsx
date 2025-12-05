import React, { useEffect, useState, useMemo, useRef } from "react";
import AdminLayout from "../AdminLayout";
import { getRevenuePerStation } from "../../api/api";
import {
  Search,
  Filter,
  DownloadCloud,
  RefreshCw,
  PieChart,
  TrendingUp,
  MapPin,
  Eye,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";

export default function AdminRevenuePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [showChart, setShowChart] = useState(true);
  const [deleteModal, setDeleteModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "total_revenue", direction: "desc" });
  const searchTimeoutRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (showChart && rows.length > 0 && chartRef.current) {
      renderChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [showChart, rows]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getRevenuePerStation();
      if (!res.error) {
        setRows(res.map((r, idx) => ({
          ...r,
          id: r.id || idx,
          name: r.name || `Station ${idx + 1}`,
          owner: r.owner || "N/A",
          location: r.location || "Unknown",
          total_revenue: r.total_revenue || 0,
          avg_price: r.avg_price || 0,
          reservations: r.reservations || 0,
          last_7d_percent: r.last_7d_percent || 0,
        })));
      }
    } catch (error) {
      showToast("Failed to load revenue data", "error");
    } finally {
      setLoading(false);
    }
  };

  const renderChart = async () => {
    if (!chartRef.current) return;

    try {
      const Chart = (await import("chart.js/auto")).default;

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const top10 = [...rows]
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      const ctx = chartRef.current.getContext("2d");
      chartInstanceRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: top10.map((r) => r.name),
          datasets: [
            {
              label: "Revenue (₹)",
              data: top10.map((r) => r.total_revenue),
              backgroundColor: "rgba(6, 182, 212, 0.8)",
              borderColor: "rgba(6, 182, 212, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(11, 18, 32, 0.95)",
              titleColor: "#fff",
              bodyColor: "#94a3b8",
              borderColor: "rgba(6, 182, 212, 0.5)",
              borderWidth: 1,
              callbacks: {
                label: (context) => `Revenue: ₹${context.parsed.y.toLocaleString()}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(255, 255, 255, 0.05)" },
              ticks: { color: "#94a3b8" },
            },
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 45 },
            },
          },
        },
      });
    } catch (error) {
      console.warn("Chart.js not available or failed to render");
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

  const filteredAndSortedRows = useMemo(() => {
    let filtered = [...rows];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.owner.toLowerCase().includes(query) ||
          r.location.toLowerCase().includes(query)
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
  }, [rows, searchQuery, statusFilter, sortConfig]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleDelete = async (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDeleteModal(null);
    showToast("Station deleted successfully", "success");
    setTimeout(load, 1000);
  };

  const exportCSV = (data = filteredAndSortedRows) => {
    const headers = ["Station", "Owner", "Location", "Total Revenue", "Avg Price", "Reservations", "Last 7d %"];
    const csv = [
      headers.join(","),
      ...data.map((r) =>
        [r.name, r.owner, r.location, r.total_revenue, r.avg_price, r.reservations, r.last_7d_percent].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully", "success");
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AdminLayout title="Station Revenue">
      <style>{`
        :root {
          --bg: #0f1724;
          --card: #0b1220;
          --muted: #94a3b8;
          --accentA: #06b6d4;
          --accentB: #6366f1;
          --success: #10b981;
          --danger: #ef4444;
          --glass: rgba(255, 255, 255, 0.04);
        }

        .admin-revenue-page {
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
          margin-bottom: 2rem;
        }

        .header h1 {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accentA), var(--accentB));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .header p {
          color: var(--muted);
          font-size: 0.95rem;
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
          border-color: var(--accentA);
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
          border-color: var(--accentA);
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

        .btn-primary {
          background: linear-gradient(135deg, var(--accentA), var(--accentB));
          color: #fff;
        }

        .btn-secondary {
          background: var(--glass);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .btn-danger {
          background: var(--danger);
          color: #fff;
        }

        .btn:focus-visible {
          outline: 2px solid var(--accentA);
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

        .chart-container {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          height: 350px;
        }

        .chart-fallback {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .chart-fallback h3 {
          margin-bottom: 1rem;
          color: var(--accentA);
        }

        .chart-fallback-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .revenue-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .revenue-card {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s;
          cursor: pointer;
        }

        .revenue-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
          border-color: var(--accentA);
        }

        .revenue-card.deleting {
          animation: fadeOut 0.3s forwards;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
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

        .card-revenue {
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--accentA);
          margin-bottom: 1rem;
        }

        .card-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .card-stat {
          font-size: 0.85rem;
        }

        .card-stat-label {
          color: var(--muted);
          margin-bottom: 0.25rem;
        }

        .card-stat-value {
          font-weight: 600;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          padding: 0.5rem;
          border-radius: 6px;
          background: var(--glass);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .icon-btn:active {
          transform: scale(0.95);
        }

        .icon-btn:focus-visible {
          outline: 2px solid var(--accentA);
          outline-offset: 2px;
        }

        .table-container {
          background: var(--card);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: none;
        }

        @media (min-width: 768px) {
          .revenue-grid {
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
          color: var(--accentA);
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

        .trend-positive {
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .trend-negative {
          color: var(--danger);
          display: flex;
          align-items: center;
          gap: 0.25rem;
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
          border-color: var(--success);
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
          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="admin-revenue-page">
        <div className="header">
          <h1>Station Revenue Dashboard</h1>
          <p>Monitor and analyze revenue performance across all charging stations</p>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <Search className="icon" size={18} />
            <input
              type="text"
              placeholder="Search stations, owners, locations..."
              onChange={handleSearchChange}
              aria-label="Search stations"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All Stations</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            aria-label="Select date range"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>

          <button
            className="btn btn-secondary"
            onClick={() => exportCSV()}
            aria-label="Export to CSV"
          >
            <DownloadCloud size={18} />
            Export CSV
          </button>

          <button
            className="btn btn-secondary"
            onClick={load}
            aria-label="Refresh data"
          >
            <RefreshCw size={18} />
            Refresh
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowChart(!showChart)}
            aria-label="Toggle chart view"
          >
            <PieChart size={18} />
            {showChart ? "Hide" : "Show"} Chart
          </button>
        </div>

        {loading && (
          <div className="revenue-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="shimmer-card">
                <div className="shimmer-bar" />
                <div className="shimmer-bar" />
                <div className="shimmer-bar" />
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <AlertCircle size={64} />
            <h3>No Stations Found</h3>
            <p>Start by adding your first charging station to track revenue</p>
            <button className="btn btn-primary">Add Station</button>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {showChart && (
              <div className="chart-container">
                <canvas ref={chartRef} />
              </div>
            )}

            <div className="revenue-grid">
              {paginatedRows.map((row) => (
                <div
                  key={row.id}
                  className={`revenue-card ${deleteModal?.id === row.id ? "deleting" : ""}`}
                >
                  <div className="card-header">
                    <div>
                      <div className="card-title">{row.name}</div>
                      <div className="card-subtitle">
                        <MapPin size={14} style={{ display: "inline", marginRight: "4px" }} />
                        {row.location}
                      </div>
                    </div>
                  </div>

                  <div className="card-revenue">₹{row.total_revenue.toLocaleString()}</div>

                  <div className="card-stats">
                    <div className="card-stat">
                      <div className="card-stat-label">Avg Price</div>
                      <div className="card-stat-value">₹{row.avg_price}</div>
                    </div>
                    <div className="card-stat">
                      <div className="card-stat-label">Bookings</div>
                      <div className="card-stat-value">{row.reservations}</div>
                    </div>
                    <div className="card-stat">
                      <div className="card-stat-label">Owner</div>
                      <div className="card-stat-value">{row.owner}</div>
                    </div>
                    <div className="card-stat">
                      <div className="card-stat-label">Last 7d</div>
                      <div
                        className={`card-stat-value ${
                          row.last_7d_percent >= 0 ? "trend-positive" : "trend-negative"
                        }`}
                      >
                        <TrendingUp size={14} />
                        {row.last_7d_percent}%
                      </div>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      className="icon-btn"
                      onClick={() => alert(`View details for ${row.name}`)}
                      aria-label={`View details for ${row.name}`}
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => exportCSV([row])}
                      aria-label={`Export ${row.name} data`}
                    >
                      <DownloadCloud size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setDeleteModal(row)}
                      aria-label={`Delete ${row.name}`}
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort("name")}>
                      Station
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("owner")}>
                      Owner
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("location")}>
                      Location
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("total_revenue")}>
                      Total Revenue
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("avg_price")}>
                      Avg Price
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("reservations")}>
                      Reservations
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th onClick={() => handleSort("last_7d_percent")}>
                      Last 7d %
                      <ArrowUpDown className="sort-icon" size={14} />
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={deleteModal?.id === row.id ? "deleting" : ""}
                    >
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>{row.owner}</td>
                      <td>{row.location}</td>
                      <td style={{ fontWeight: 600, color: "var(--accentA)" }}>
                        ₹{row.total_revenue.toLocaleString()}
                      </td>
                      <td>₹{row.avg_price}</td>
                      <td>{row.reservations}</td>
                      <td>
                        <span
                          className={
                            row.last_7d_percent >= 0 ? "trend-positive" : "trend-negative"
                          }
                        >
                          <TrendingUp size={14} />
                          {row.last_7d_percent}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="icon-btn"
                            onClick={() => alert(`View details for ${row.name}`)}
                            aria-label={`View details for ${row.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => exportCSV([row])}
                            aria-label={`Export ${row.name} data`}
                          >
                            <DownloadCloud size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => setDeleteModal(row)}
                            aria-label={`Delete ${row.name}`}
                            style={{ color: "var(--danger)" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination">
                <div className="page-info">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredAndSortedRows.length)} of{" "}
                  {filteredAndSortedRows.length} results
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <label htmlFor="pageSize" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
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

        {deleteModal && (
          <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="delete-modal-title">
              <h3 id="delete-modal-title">Confirm Deletion</h3>
              <p>
                Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action
                cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setDeleteModal(null)}
                >
                  <X size={18} />
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(deleteModal.id)}
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`toast ${toast.type}`} role="alert" aria-live="polite">
            {toast.type === "success" ? (
              <div style={{ color: "var(--success)" }}>✓</div>
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
