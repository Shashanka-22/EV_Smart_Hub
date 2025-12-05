import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "../AdminLayout";
import { getAllUsers, deleteUserAdmin } from "../../api/api";
import { Search, Users, PlusSquare, Edit2, Trash2, User, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setUsers(null);
    const res = await getAllUsers();
    if (!res.error) {
      setUsers(res);
      setSelectedIds(new Set());
    } else {
      showToast("Failed to load users", "error");
      setUsers([]);
    }
  };

  const removeUser = async (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showToast("User deleted", "success");

    const res = await deleteUserAdmin(id);
    if (res?.error) {
      showToast("Failed to delete user", "error");
      load();
    }
  };

  const bulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)));
    setShowBulkDeleteModal(false);
    setSelectedIds(new Set());
    showToast(`Deleted ${idsToDelete.length} user(s)`, "success");

    for (const id of idsToDelete) {
      const res = await deleteUserAdmin(id);
      if (res?.error) {
        showToast("Some deletions failed", "error");
        load();
        return;
      }
    }
  };

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const exportCSV = () => {
    const csv = [
      ["Username", "Email", "Role", "Status"],
      ...filteredUsers.map((u) => [
        u.username || "",
        u.email || "",
        u.role || "user",
        u.status || "active",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        roleFilter === "all" || (u.role || "user") === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  const getInitials = (username, email) => {
    if (username) return username.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return "??";
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <AdminLayout title="All Users">
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

        .admin-users-container {
          background: var(--bg);
          color: #f1f5f9;
          min-height: 100vh;
          padding: 1.5rem;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .admin-users-header {
          margin-bottom: 2rem;
        }

        .admin-users-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--accentA), var(--accentB));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .admin-users-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.75rem;
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accentA);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }

        .role-select {
          padding: 0.75rem 1rem;
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .role-select:focus {
          outline: none;
          border-color: var(--accentB);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, var(--accentA), var(--accentB));
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toolbar-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(6, 182, 212, 0.3);
        }

        .toolbar-btn:active {
          transform: translateY(0);
        }

        .toolbar-btn:focus-visible {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .toolbar-btn.secondary {
          background: var(--glass);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toolbar-btn.danger {
          background: var(--danger);
        }

        .toolbar-btn.danger:hover {
          box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);
        }

        .bulk-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--accentB);
          border-radius: 8px;
          font-size: 0.9rem;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .skeleton-container {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .skeleton-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .skeleton-container {
            grid-template-columns: 1fr;
          }
        }

        .skeleton-row {
          background: var(--card);
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .skeleton-shimmer {
          height: 20px;
          background: linear-gradient(
            90deg,
            var(--glass) 25%,
            rgba(255, 255, 255, 0.08) 50%,
            var(--glass) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 0.75rem;
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .users-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .users-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .users-grid {
            display: none;
          }
        }

        .user-card {
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.25rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .user-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
          border-color: var(--accentA);
        }

        .user-card:focus-within {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .user-card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accentA), var(--accentB));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          color: white;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-email {
          color: var(--muted);
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .badge.role {
          background: rgba(99, 102, 241, 0.2);
          color: var(--accentB);
          border: 1px solid var(--accentB);
        }

        .badge.status-active {
          background: rgba(16, 185, 129, 0.2);
          color: var(--success);
          border: 1px solid var(--success);
        }

        .badge.status-inactive {
          background: rgba(239, 68, 68, 0.2);
          color: var(--danger);
          border: 1px solid var(--danger);
        }

        .user-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--glass);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-btn:hover {
          background: var(--accentA);
          border-color: var(--accentA);
          transform: scale(1.1);
        }

        .icon-btn.delete {
          color: var(--danger);
        }

        .icon-btn.delete:hover {
          background: var(--danger);
          color: white;
        }

        .icon-btn:active {
          transform: scale(0.95);
          animation: pressDown 0.1s ease;
        }

        @keyframes pressDown {
          0%, 100% {
            transform: scale(0.95);
          }
          50% {
            transform: scale(0.9);
          }
        }

        .icon-btn:focus-visible {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .users-table-container {
          display: none;
        }

        @media (min-width: 1024px) {
          .users-table-container {
            display: block;
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            overflow: hidden;
          }
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table thead {
          background: var(--glass);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .users-table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }

        .users-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .users-table tbody tr {
          transition: all 0.2s;
        }

        .users-table tbody tr:hover {
          background: var(--glass);
        }

        .users-table tbody tr.removing {
          animation: fadeOut 0.3s ease forwards;
        }

        @keyframes fadeOut {
          to {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        .table-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--accentA);
        }

        .checkbox:focus-visible {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal {
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
          animation: pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes pop {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          padding: 0.25rem;
          transition: all 0.2s;
        }

        .modal-close:hover {
          color: #f1f5f9;
          transform: rotate(90deg);
        }

        .modal-body {
          margin-bottom: 1.5rem;
          color: var(--muted);
          line-height: 1.6;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .modal-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-btn.cancel {
          background: var(--glass);
          color: #f1f5f9;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-btn.cancel:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .modal-btn.confirm {
          background: var(--danger);
          color: white;
        }

        .modal-btn.confirm:hover {
          box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);
          transform: translateY(-2px);
        }

        .modal-btn:focus-visible {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 2rem;
          padding: 1rem;
          background: var(--glass);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pagination-info {
          color: var(--muted);
          font-size: 0.9rem;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .page-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--glass);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-btn:hover:not(:disabled) {
          background: var(--accentA);
          border-color: var(--accentA);
        }

        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-btn:focus-visible {
          outline: 3px solid var(--accentA);
          outline-offset: 2px;
        }

        .page-size-select {
          padding: 0.5rem 0.75rem;
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .toasts-container {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 2000;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          pointer-events: none;
        }

        .toast {
          background: var(--card);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 1rem 1.5rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 300px;
          animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
          pointer-events: auto;
        }

        .toast.success {
          border-left: 4px solid var(--success);
        }

        .toast.error {
          border-left: 4px solid var(--danger);
        }

        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastOut {
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .toast-message {
          flex: 1;
          font-size: 0.95rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: var(--muted);
        }

        .empty-icon {
          margin: 0 auto 1rem;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #f1f5f9;
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

        @media (max-width: 640px) {
          .admin-users-toolbar {
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .toolbar-btn {
            width: 100%;
            justify-content: center;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-controls {
            justify-content: center;
          }
        }
      `}</style>

      <div className="admin-users-container">
        <div className="admin-users-header">
          <h1 className="admin-users-title">All Users</h1>
        </div>

        <div className="admin-users-toolbar">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search users"
            />
          </div>

          <select
            className="role-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
          </select>

          <button
            className="toolbar-btn secondary"
            onClick={exportCSV}
            aria-label="Export to CSV"
          >
            <Users size={18} />
            Export CSV
          </button>

          <button
            className="toolbar-btn"
            onClick={() => showToast("Add user feature coming soon!", "success")}
            aria-label="Add new user"
          >
            <PlusSquare size={18} />
            Add User
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="bulk-actions">
            <span>{selectedIds.size} selected</span>
            <button
              className="toolbar-btn danger"
              onClick={() => setShowBulkDeleteModal(true)}
              aria-label={`Delete ${selectedIds.size} selected users`}
            >
              <Trash2 size={18} />
              Delete Selected
            </button>
          </div>
        )}

        {users === null ? (
          <div className="skeleton-container" aria-live="polite" aria-busy="true">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-shimmer" style={{ width: "60%" }} />
                <div className="skeleton-shimmer" style={{ width: "80%" }} />
                <div className="skeleton-shimmer" style={{ width: "40%" }} />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" size={64} />
            <h3 className="empty-title">No users found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="users-grid">
              {paginatedUsers.map((user) => (
                <div key={user.id} className="user-card">
                  <div className="user-card-header">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      aria-label={`Select ${user.username || user.email}`}
                    />
                    <div className="user-avatar" aria-hidden="true">
                      {getInitials(user.username, user.email)}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.username || "Unknown"}</div>
                      <div className="user-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="user-meta">
                    <span className="badge role" aria-label={`Role: ${user.role || "user"}`}>
                      {user.role || "user"}
                    </span>
                    <span
                      className={`badge status-${user.status || "active"}`}
                      aria-label={`Status: ${user.status || "active"}`}
                    >
                      {user.status || "active"}
                    </span>
                  </div>
                  <div className="user-actions">
                    <button
                      className="icon-btn"
                      onClick={() => showToast("Edit feature coming soon!", "success")}
                      aria-label={`Edit ${user.username || user.email}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          showToast("Edit feature coming soon!", "success");
                        }
                      }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className="icon-btn delete"
                      onClick={() => removeUser(user.id)}
                      aria-label={`Delete ${user.username || user.email}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          removeUser(user.id);
                        }
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="Select all users"
                      />
                    </th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          aria-label={`Select ${user.username || user.email}`}
                        />
                      </td>
                      <td>
                        <div className="table-user-info">
                          <div className="user-avatar" aria-hidden="true">
                            {getInitials(user.username, user.email)}
                          </div>
                          <span>{user.username || "Unknown"}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className="badge role">{user.role || "user"}</span>
                      </td>
                      <td>
                        <span className={`badge status-${user.status || "active"}`}>
                          {user.status || "active"}
                        </span>
                      </td>
                      <td>
                        <div className="user-actions">
                          <button
                            className="icon-btn"
                            onClick={() => showToast("Edit feature coming soon!", "success")}
                            aria-label={`Edit ${user.username || user.email}`}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="icon-btn delete"
                            onClick={() => removeUser(user.id)}
                            aria-label={`Delete ${user.username || user.email}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredUsers.length > 0 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {((currentPage - 1) * pageSize) + 1}-
                  {Math.min(currentPage * pageSize, filteredUsers.length)} of{" "}
                  {filteredUsers.length} users
                </div>
                <div className="pagination-controls">
                  <label htmlFor="page-size-select" style={{ color: "var(--muted)", fontSize: "0.9rem", marginRight: "0.5rem" }}>
                    Per page:
                  </label>
                  <select
                    id="page-size-select"
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Users per page"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {showBulkDeleteModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowBulkDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 id="modal-title" className="modal-title">Confirm Deletion</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowBulkDeleteModal(false)}
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="modal-body">
                Are you sure you want to delete {selectedIds.size} user(s)? This action
                cannot be undone.
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowBulkDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={bulkDelete}
                  autoFocus
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="toasts-container" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.type === "success" && <User size={20} style={{ color: "var(--success)" }} />}
              {toast.type === "error" && <X size={20} style={{ color: "var(--danger)" }} />}
              <span className="toast-message">{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
