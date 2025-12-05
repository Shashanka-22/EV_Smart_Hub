import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "../AdminLayout";
import { getAllStationsAdmin, deleteStationAdmin } from "../../api/api";
import {
  Search,
  Filter,
  Download,
  PlusSquare,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  ZapOff,
} from "lucide-react";

export default function AdminStationsPage() {
  const [stations, setStations] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadStations = async () => {
    setStations(null);
    const res = await getAllStationsAdmin();
    if (!res.error) {
      setStations(res);
    } else {
      setStations([]);
      showToast("Failed to load stations", "error");
    }
  };

  const deleteStation = async (id, name) => {
    const stationsCopy = [...stations];
    setStations(stations.filter((s) => s.id !== id));
    setDeleteModal(null);
    setSelectedIds(new Set());

    const res = await deleteStationAdmin(id);
    if (!res.error) {
      showToast(`Station "${name}" deleted successfully`, "success");
      loadStations();
    } else {
      setStations(stationsCopy);
      showToast("Failed to delete station", "error");
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const idsToDelete = Array.from(selectedIds);
    const stationsCopy = [...stations];
    setStations(stations.filter((s) => !selectedIds.has(s.id)));
    setDeleteModal(null);
    setSelectedIds(new Set());

    let successCount = 0;
    for (const id of idsToDelete) {
      const res = await deleteStationAdmin(id);
      if (!res.error) successCount++;
    }

    if (successCount === idsToDelete.length) {
      showToast(`${successCount} stations deleted successfully`, "success");
    } else if (successCount > 0) {
      showToast(
        `${successCount} of ${idsToDelete.length} stations deleted`,
        "warning"
      );
    } else {
      setStations(stationsCopy);
      showToast("Failed to delete stations", "error");
    }
    loadStations();
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  const exportCSV = () => {
    if (!stations || stations.length === 0) return;

    const headers = [
      "Name",
      "Location",
      "Price per kWh",
      "Fast Charger",
      "Total Slots",
      "Status",
      "Owner Name",
      "Owner Email",
      "Owner Phone",
    ];
    const rows = filteredStations.map((s) => [
      s.name,
      s.location,
      s.price_per_kwh,
      s.fast_charger ? "Yes" : "No",
      s.total_slots,
      s.status,
      s.owner_name,
      s.owner_email,
      s.owner_phone || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `stations_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("CSV exported successfully", "success");
  };

  const filteredStations = useMemo(() => {
    if (!stations) return [];

    return stations.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.owner_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [stations, searchQuery, statusFilter]);

  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStations.slice(startIndex, startIndex + pageSize);
  }, [filteredStations, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStations.length / pageSize);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedStations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedStations.map((s) => s.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "var(--success)";
      case "pending":
        return "var(--warning)";
      case "rejected":
        return "var(--danger)";
      default:
        return "var(--muted)";
    }
  };

  return (
    <AdminLayout title="All Stations">
      <style>
        {`
          :root {
            --bg: #0f1724;
            --panel: #0b1220;
            --muted: #94a3b8;
            --accentA: #06b6d4;
            --accentB: #6366f1;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --glass: rgba(255, 255, 255, 0.04);
          }

          .admin-stations-container {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
            background: var(--bg);
            min-height: 100vh;
            color: #fff;
          }

          .page-header {
            margin-bottom: 30px;
          }

          .page-title {
            font-size: 28px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #fff;
          }

          .page-subtitle {
            color: var(--muted);
            margin: 0;
          }

          .toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 24px;
            align-items: center;
          }

          .search-wrapper {
            position: relative;
            flex: 1;
            min-width: 200px;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--muted);
            pointer-events: none;
          }

          .search-input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            transition: all 0.2s ease;
          }

          .search-input:focus {
            outline: none;
            border-color: var(--accentA);
            box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
          }

          .filter-select {
            padding: 10px 12px;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .filter-select:focus {
            outline: none;
            border-color: var(--accentB);
          }

          .toolbar-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .toolbar-btn:hover {
            background: var(--glass);
            transform: translateY(-2px);
          }

          .toolbar-btn:active {
            transform: translateY(0) scale(0.98);
          }

          .toolbar-btn.primary {
            background: linear-gradient(135deg, var(--accentA), var(--accentB));
            border: none;
          }

          .toolbar-btn.danger {
            background: var(--danger);
            border: none;
          }

          .toolbar-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          .skeleton-grid {
            display: grid;
            gap: 20px;
            grid-template-columns: 1fr;
          }

          .skeleton-card {
            background: var(--panel);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            overflow: hidden;
          }

          .skeleton-line {
            height: 16px;
            background: var(--glass);
            border-radius: 4px;
            margin-bottom: 12px;
            position: relative;
            overflow: hidden;
          }

          .skeleton-line::after {
            content: "";
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.1),
              transparent
            );
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            100% {
              left: 100%;
            }
          }

          .cards-grid {
            display: grid;
            gap: 20px;
            grid-template-columns: 1fr;
          }

          .station-card {
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s ease;
            animation: fadeIn 0.3s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .station-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
          }

          .station-card.deleting {
            animation: fadeOut 0.3s ease forwards;
          }

          @keyframes fadeOut {
            to {
              opacity: 0;
              transform: translateY(-10px);
            }
          }

          .card-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
          }

          .checkbox-wrapper {
            margin-top: 4px;
          }

          .checkbox {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: var(--accentA);
          }

          .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accentA), var(--accentB));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            flex-shrink: 0;
          }

          .card-info {
            flex: 1;
          }

          .card-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: #fff;
          }

          .card-location {
            color: var(--muted);
            font-size: 14px;
            margin: 0;
          }

          .card-details {
            display: grid;
            gap: 12px;
            margin-bottom: 16px;
          }

          .detail-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
          }

          .detail-label {
            color: var(--muted);
            font-weight: 500;
          }

          .detail-value {
            color: #fff;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .charger-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            background: var(--glass);
          }

          .card-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .action-btn {
            flex: 1;
            min-width: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .action-btn.edit {
            background: var(--accentB);
            color: #fff;
          }

          .action-btn.delete {
            background: var(--danger);
            color: #fff;
          }

          .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }

          .action-btn:active {
            transform: translateY(0) scale(0.98);
          }

          .table-container {
            display: none;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 12px;
            overflow: hidden;
          }

          .table-wrapper {
            overflow-x: auto;
          }

          .stations-table {
            width: 100%;
            border-collapse: collapse;
          }

          .stations-table th,
          .stations-table td {
            padding: 16px;
            text-align: left;
            border-bottom: 1px solid var(--glass);
          }

          .stations-table th {
            background: var(--bg);
            color: var(--muted);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .stations-table td {
            font-size: 14px;
            color: #fff;
          }

          .stations-table tr:last-child td {
            border-bottom: none;
          }

          .stations-table tbody tr {
            transition: background 0.2s ease;
          }

          .stations-table tbody tr:hover {
            background: var(--glass);
          }

          .table-avatar-cell {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .table-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accentA), var(--accentB));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            flex-shrink: 0;
          }

          .table-actions {
            display: flex;
            gap: 8px;
          }

          .icon-btn {
            padding: 8px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .icon-btn.edit {
            background: var(--accentB);
            color: #fff;
          }

          .icon-btn.delete {
            background: var(--danger);
            color: #fff;
          }

          .icon-btn:hover {
            transform: scale(1.1);
          }

          .icon-btn:active {
            transform: scale(0.95);
          }

          .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 24px;
            flex-wrap: wrap;
            gap: 16px;
          }

          .pagination-info {
            color: var(--muted);
            font-size: 14px;
          }

          .pagination-controls {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .page-size-select {
            padding: 8px 12px;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
          }

          .pagination-buttons {
            display: flex;
            gap: 8px;
          }

          .page-btn {
            padding: 8px 12px;
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .page-btn:hover:not(:disabled) {
            background: var(--glass);
          }

          .page-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
            animation: fadeIn 0.2s ease;
          }

          .modal {
            background: var(--panel);
            border: 1px solid var(--glass);
            border-radius: 16px;
            padding: 24px;
            max-width: 500px;
            width: 100%;
            animation: popIn 0.3s ease;
          }

          @keyframes popIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }

          .modal-title {
            font-size: 20px;
            font-weight: 600;
            margin: 0;
            color: #fff;
          }

          .close-btn {
            padding: 4px;
            background: transparent;
            border: none;
            color: var(--muted);
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
          }

          .close-btn:hover {
            background: var(--glass);
            color: #fff;
          }

          .modal-body {
            margin-bottom: 24px;
            color: var(--muted);
            line-height: 1.6;
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }

          .modal-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .modal-btn.cancel {
            background: var(--glass);
            color: #fff;
          }

          .modal-btn.confirm {
            background: var(--danger);
            color: #fff;
          }

          .modal-btn:hover {
            transform: translateY(-2px);
          }

          .modal-btn:active {
            transform: translateY(0) scale(0.98);
          }

          .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 16px 20px;
            border-radius: 8px;
            color: #fff;
            font-weight: 500;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            z-index: 2000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
          }

          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          .toast.success {
            background: var(--success);
          }

          .toast.error {
            background: var(--danger);
          }

          .toast.warning {
            background: var(--warning);
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--muted);
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }

          @media (min-width: 768px) {
            .cards-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .skeleton-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (min-width: 1024px) {
            .cards-grid {
              display: none;
            }

            .table-container {
              display: block;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          button:focus-visible,
          input:focus-visible,
          select:focus-visible {
            outline: 2px solid var(--accentA);
            outline-offset: 2px;
          }
        `}
      </style>

      <div className="admin-stations-container">
        <div className="page-header">
          <h1 className="page-title">All Registered Stations</h1>
          <p className="page-subtitle">
            Manage and monitor all charging stations
          </p>
        </div>

        <div className="toolbar">
          <div className="search-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Search stations, locations, owners..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Search stations"
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          {selectedIds.size > 0 && (
            <button
              className="toolbar-btn danger"
              onClick={() =>
                setDeleteModal({ type: "bulk", count: selectedIds.size })
              }
              aria-label={`Delete ${selectedIds.size} selected stations`}
            >
              <Trash2 size={18} />
              Delete ({selectedIds.size})
            </button>
          )}

          <button
            className="toolbar-btn"
            onClick={exportCSV}
            disabled={!stations || stations.length === 0}
            aria-label="Export to CSV"
          >
            <Download size={18} />
            Export CSV
          </button>

          <button
            className="toolbar-btn primary"
            onClick={() => alert("Navigate to New Station form")}
            aria-label="Add new station"
          >
            <PlusSquare size={18} />
            New Station
          </button>
        </div>

        {stations === null && (
          <div className="skeleton-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line" style={{ width: "60%" }}></div>
                <div className="skeleton-line" style={{ width: "80%" }}></div>
                <div className="skeleton-line" style={{ width: "70%" }}></div>
                <div className="skeleton-line" style={{ width: "50%" }}></div>
              </div>
            ))}
          </div>
        )}

        {stations && filteredStations.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔌</div>
            <h3>No stations found</h3>
            <p>
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "No stations have been registered yet"}
            </p>
          </div>
        )}

        {stations && filteredStations.length > 0 && (
          <>
            <div className="cards-grid">
              {paginatedStations.map((s) => (
                <div key={s.id} className="station-card">
                  <div className="card-header">
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </div>
                    <div className="avatar">{getInitials(s.owner_name)}</div>
                    <div className="card-info">
                      <h2 className="card-title">{s.name}</h2>
                      <p className="card-location">{s.location}</p>
                    </div>
                  </div>

                  <div className="card-details">
                    <div className="detail-row">
                      <span className="detail-label">Price:</span>
                      <span className="detail-value">
                        ₹{s.price_per_kwh}/kWh
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Slots:</span>
                      <span className="detail-value">{s.total_slots}</span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Charger:</span>
                      <span className="charger-badge">
                        {s.fast_charger ? (
                          <>
                            <Zap size={14} /> Fast
                          </>
                        ) : (
                          <>
                            <ZapOff size={14} /> Standard
                          </>
                        )}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span
                        className="status-badge"
                        style={{
                          background: getStatusColor(s.status),
                          color: "#fff",
                        }}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Owner:</span>
                      <span className="detail-value">{s.owner_name}</span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => alert(`Edit station: ${s.name}`)}
                      aria-label={`Edit ${s.name}`}
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => setDeleteModal({ type: "single", station: s })}
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="table-container">
              <div className="table-wrapper">
                <table className="stations-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            paginatedStations.length > 0 &&
                            selectedIds.size === paginatedStations.length
                          }
                          onChange={toggleSelectAll}
                          aria-label="Select all stations"
                        />
                      </th>
                      <th>Station</th>
                      <th>Location</th>
                      <th>Price</th>
                      <th>Slots</th>
                      <th>Charger</th>
                      <th>Status</th>
                      <th>Owner</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStations.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            aria-label={`Select ${s.name}`}
                          />
                        </td>
                        <td>
                          <div className="table-avatar-cell">
                            <div className="table-avatar">
                              {getInitials(s.owner_name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>{s.location}</td>
                        <td>₹{s.price_per_kwh}</td>
                        <td>{s.total_slots}</td>
                        <td>
                          <span className="charger-badge">
                            {s.fast_charger ? (
                              <>
                                <Zap size={12} /> Fast
                              </>
                            ) : (
                              <>
                                <ZapOff size={12} /> Standard
                              </>
                            )}
                          </span>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background: getStatusColor(s.status),
                              color: "#fff",
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "13px" }}>
                            <div style={{ fontWeight: 500 }}>
                              {s.owner_name}
                            </div>
                            <div style={{ color: "var(--muted)" }}>
                              {s.owner_email}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-btn edit"
                              onClick={() => alert(`Edit station: ${s.name}`)}
                              aria-label={`Edit ${s.name}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="icon-btn delete"
                              onClick={() =>
                                setDeleteModal({ type: "single", station: s })
                              }
                              aria-label={`Delete ${s.name}`}
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

            <div className="pagination">
              <div className="pagination-info">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredStations.length)} of{" "}
                {filteredStations.length} stations
              </div>

              <div className="pagination-controls">
                <select
                  className="page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Results per page"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>

                <div className="pagination-buttons">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    className="page-btn"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {deleteModal && (
          <div
            className="modal-overlay"
            onClick={() => setDeleteModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title" id="modal-title">
                  Confirm Deletion
                </h2>
                <button
                  className="close-btn"
                  onClick={() => setDeleteModal(null)}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {deleteModal.type === "single" ? (
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>{deleteModal.station.name}</strong>? This action
                    cannot be undone.
                  </p>
                ) : (
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>{deleteModal.count} stations</strong>? This action
                    cannot be undone.
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setDeleteModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={() => {
                    if (deleteModal.type === "single") {
                      deleteStation(
                        deleteModal.station.id,
                        deleteModal.station.name
                      );
                    } else {
                      bulkDelete();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`toast ${toast.type}`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
