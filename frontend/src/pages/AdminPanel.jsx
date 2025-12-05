import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  getMyStations,
  createStation,
  updateStation,
  deleteStation,
} from "../api/api";

const initialFormData = {
  name: "",
  location: "",
  latitude: "",
  longitude: "",
  total_slots: 5,
  price_per_kwh: "",
  fast_charger: true,
};

export default function AdminPanel() {
  const [stations, setStations] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [optimisticUpdate, setOptimisticUpdate] = useState(null);
  const [copiedCoord, setCopiedCoord] = useState(null);

  const formRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const submitTimeoutRef = useRef(null);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyStations();
      setStations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      showMessage("Failed to fetch stations", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    if (message) {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 4000);
      return () => {
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      };
    }
  }, [message]);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
  };

  const validateForm = () => {
    const errors = {};
    const required = ["name", "location", "latitude", "longitude", "price_per_kwh"];

    required.forEach((field) => {
      if (!formData[field]) {
        errors[field] = `${field.replace(/_/g, " ")} is required`;
      }
    });

    if (formData.latitude && (isNaN(formData.latitude) || parseFloat(formData.latitude) < -90 || parseFloat(formData.latitude) > 90)) {
      errors.latitude = "Latitude must be between -90 and 90";
    }

    if (formData.longitude && (isNaN(formData.longitude) || parseFloat(formData.longitude) < -180 || parseFloat(formData.longitude) > 180)) {
      errors.longitude = "Longitude must be between -180 and 180";
    }

    if (formData.price_per_kwh && isNaN(formData.price_per_kwh)) {
      errors.price_per_kwh = "Price must be a valid number";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showMessage("Please fix the errors below", "error");
      return;
    }

    const payload = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      price_per_kwh: parseFloat(formData.price_per_kwh),
      total_slots: Number(formData.total_slots),
      fast_charger: formData.fast_charger ? 1 : 0,
    };

    try {
      if (editMode) {
        setOptimisticUpdate(editingId);
        const res = await updateStation(editingId, payload);
        if (res?.error) {
          setOptimisticUpdate(null);
          return showMessage(res.error, "error");
        }
        showMessage("Station updated successfully!", "success");
      } else {
        const res = await createStation(payload);
        if (res?.error) {
          return showMessage(res.error, "error");
        }
        showMessage("Station submitted for admin approval!", "success");
      }

      setFormData(initialFormData);
      setEditMode(false);
      setEditingId(null);
      setValidationErrors({});
      setOptimisticUpdate(null);

      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = setTimeout(() => {
        fetchStations();
      }, 500);
    } catch (err) {
      console.error(err);
      setOptimisticUpdate(null);
      showMessage("Failed to save station", "error");
    }
  };

  const handleEdit = (station) => {
    if (station.status === "pending") {
      showMessage("Cannot edit pending approval stations", "warning");
      return;
    }

    setEditMode(true);
    setEditingId(station.id);
    setFormData({
      name: station.name,
      location: station.location,
      latitude: station.latitude?.toString() || "",
      longitude: station.longitude?.toString() || "",
      total_slots: station.total_slots,
      price_per_kwh: station.price_per_kwh?.toString() || "",
      fast_charger: station.fast_charger === 1,
    });
    setValidationErrors({});

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDeleteClick = (station) => {
    if (station.status === "pending") {
      showMessage("Cannot delete pending approval stations", "warning");
      return;
    }

    setConfirmModal({
      title: "Delete Station",
      message: `Are you sure you want to delete "${station.name}"? This action cannot be undone.`,
      stationId: station.id,
      stationName: station.name,
    });
  };

  const confirmDelete = async () => {
    const stationId = confirmModal.stationId;
    setConfirmModal(null);

    try {
      setOptimisticUpdate(stationId);
      const res = await deleteStation(stationId);
      if (res?.error) {
        setOptimisticUpdate(null);
        return showMessage(res.error, "error");
      }

      showMessage("Station deleted successfully", "success");
      setOptimisticUpdate(null);
      fetchStations();
    } catch (err) {
      console.error(err);
      setOptimisticUpdate(null);
      showMessage("Failed to delete station", "error");
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCoord(label);
      setTimeout(() => setCopiedCoord(null), 2000);
    });
  };

  const filteredStations = useMemo(() => {
    return stations.filter(
      (s) => optimisticUpdate !== s.id || editMode
    );
  }, [stations, optimisticUpdate, editMode]);

  return (
    <>
      <style>{`
        :root {
          --color-base: #0b1220;
          --color-base-light: #1e293b;
          --color-surface: #f8fafc;
          --color-surface-elevated: #ffffff;
          --color-primary-start: #06b6d4;
          --color-primary-end: #6366f1;
          --color-success: #10b981;
          --color-warning: #f59e0b;
          --color-danger: #ef4444;
          --color-text-primary: #0f172a;
          --color-text-secondary: #64748b;
          --color-text-muted: #94a3b8;
          --color-border: #e2e8f0;

          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

          --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
          --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
          --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.5); }
        }

        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 0.8;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }

        @keyframes toastSlide {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes overlayFade {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr !important;
          }
          .stations-grid {
            grid-template-columns: 1fr !important;
          }
          .modal-content {
            width: 90vw !important;
            max-height: 80vh !important;
          }
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            #e2e8f0 0%,
            #f1f5f9 50%,
            #e2e8f0 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
          border-radius: 12px;
        }

        .focus-ring:focus-visible {
          outline: 2px solid var(--color-primary-end);
          outline-offset: 2px;
        }

        .hover-lift {
          transition: transform var(--transition-base), box-shadow var(--transition-base);
        }

        .hover-lift:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
        }

        input, select, textarea {
          font-family: inherit;
        }

        input::placeholder, select::placeholder {
          color: var(--color-text-muted);
        }

        input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid var(--color-primary-end);
          outline-offset: 2px;
        }

        button, [role="button"] {
          min-height: 44px;
          min-width: 44px;
          position: relative;
          overflow: hidden;
        }

        .ripple-button::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: ripple 0.6s ease-out;
          pointer-events: none;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
          padding: "24px",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          color: "var(--color-text-primary)",
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        {/* Toast Messages */}
        {message && (
          <Toast
            message={message.text}
            type={message.type}
            onClose={() => setMessage(null)}
          />
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <ConfirmModal
            modal={confirmModal}
            onConfirm={confirmDelete}
            onCancel={() => setConfirmModal(null)}
          />
        )}

        {/* Hero Header */}
        <header
          style={{
            background: "rgba(248, 250, 252, 0.05)",
            backdropFilter: "blur(20px)",
            borderRadius: "20px",
            padding: "40px",
            marginBottom: "32px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            animation: "slideDown 0.6s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                boxShadow: "0 8px 16px rgba(99, 102, 241, 0.3)",
              }}
              aria-hidden="true"
            >
              ⚙️
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "36px",
                  fontWeight: "700",
                  background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Station Manager
              </h1>
              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "var(--color-text-muted)",
                  fontSize: "16px",
                }}
              >
                Create and manage your EV charging stations
              </p>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Add/Edit Form */}
          <section
            ref={formRef}
            style={{
              background: "rgba(248, 250, 252, 0.05)",
              backdropFilter: "blur(20px)",
              borderRadius: "20px",
              padding: "32px",
              marginBottom: "32px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              animation: "slideUp 0.6s ease-out 0.1s both",
            }}
            aria-labelledby="form-title"
          >
            <h2
              id="form-title"
              style={{
                margin: "0 0 24px 0",
                fontSize: "24px",
                fontWeight: "600",
                color: "var(--color-surface)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span aria-hidden="true">{editMode ? "✏️" : "➕"}</span>
              {editMode ? "Edit Station" : "Add New Station"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div
                className="form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <FormField
                  label="Station Name"
                  placeholder="e.g., Downtown Charging Hub"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={validationErrors.name}
                  required
                />

                <FormField
                  label="Location"
                  placeholder="e.g., 123 Main Street, Downtown"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  error={validationErrors.location}
                  required
                />

                <FormField
                  label="Latitude"
                  placeholder="e.g., 28.7041"
                  type="number"
                  step="0.0001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  error={validationErrors.latitude}
                  hint="Use Google Maps to find coordinates"
                  required
                />

                <FormField
                  label="Longitude"
                  placeholder="e.g., 77.1025"
                  type="number"
                  step="0.0001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  error={validationErrors.longitude}
                  hint="Right-click on map location"
                  required
                />

                <FormField
                  label="Total Slots"
                  placeholder="e.g., 5"
                  type="number"
                  min="1"
                  value={formData.total_slots}
                  onChange={(e) => setFormData({ ...formData, total_slots: e.target.value })}
                />

                <FormField
                  label="Price per kWh (₹)"
                  placeholder="e.g., 8.50"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_kwh}
                  onChange={(e) => setFormData({ ...formData, price_per_kwh: e.target.value })}
                  error={validationErrors.price_per_kwh}
                  required
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  marginBottom: "24px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <input
                  type="checkbox"
                  id="fast-charger"
                  checked={formData.fast_charger}
                  onChange={(e) => setFormData({ ...formData, fast_charger: e.target.checked })}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                    accentColor: "#6366f1",
                  }}
                />
                <label
                  htmlFor="fast-charger"
                  style={{
                    color: "var(--color-surface)",
                    fontSize: "16px",
                    fontWeight: "500",
                    cursor: "pointer",
                    margin: 0,
                  }}
                >
                  This is a fast charger (DC charging)
                </label>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "14px 24px",
                    background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all var(--transition-base)",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 8px 20px rgba(99, 102, 241, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                  }}
                >
                  {editMode ? "Update Station" : "Create Station"}
                </button>

                {editMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setEditingId(null);
                      setFormData(initialFormData);
                      setValidationErrors({});
                    }}
                    style={{
                      flex: 1,
                      padding: "14px 24px",
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "var(--color-surface)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all var(--transition-base)",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(255, 255, 255, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Stations List */}
          <section aria-labelledby="stations-title">
            <h2
              id="stations-title"
              style={{
                margin: "0 0 24px 0",
                fontSize: "24px",
                fontWeight: "600",
                color: "var(--color-surface)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span aria-hidden="true">📍</span>
              Your Stations ({filteredStations.length})
            </h2>

            {loading ? (
              <div
                className="stations-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton" style={{ height: "280px" }} />
                ))}
              </div>
            ) : filteredStations.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "rgba(248, 250, 252, 0.05)",
                  borderRadius: "20px",
                  border: "1px dashed rgba(255, 255, 255, 0.2)",
                  color: "var(--color-text-muted)",
                }}
              >
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚗</div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}>
                  No stations yet
                </h3>
                <p style={{ margin: "0", fontSize: "16px" }}>
                  Create your first charging station to get started
                </p>
              </div>
            ) : (
              <div
                className="stations-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {filteredStations.map((station, idx) => (
                  <StationCard
                    key={station.id}
                    station={station}
                    index={idx}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    isOptimistic={optimisticUpdate === station.id}
                    copiedCoord={copiedCoord}
                    onCopyCoord={copyToClipboard}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function FormField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  error,
  required = false,
  hint,
  ...props
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "8px",
          fontSize: "14px",
          fontWeight: "600",
          color: "var(--color-surface)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--color-danger)", marginLeft: "4px" }}>*</span>
        )}
      </label>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "rgba(255, 255, 255, 0.08)",
          border: error
            ? "2px solid var(--color-danger)"
            : "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "12px",
          fontSize: "15px",
          color: "var(--color-surface)",
          transition: "all var(--transition-base)",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.12)";
          e.target.style.borderColor = error
            ? "var(--color-danger)"
            : "rgba(99, 102, 241, 0.5)";
        }}
        onBlur={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.08)";
          e.target.style.borderColor = error
            ? "var(--color-danger)"
            : "rgba(255, 255, 255, 0.2)";
        }}
        {...props}
      />

      {error && (
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: "13px",
            color: "var(--color-danger)",
            fontWeight: "500",
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      {hint && !error && (
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: "13px",
            color: "var(--color-text-muted)",
          }}
        >
          💡 {hint}
        </p>
      )}
    </div>
  );
}

function StationCard({
  station,
  index,
  onEdit,
  onDelete,
  isOptimistic,
  copiedCoord,
  onCopyCoord,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const statusStyles = {
    approved: {
      bg: "rgba(16, 185, 129, 0.15)",
      text: "#10b981",
      label: "Approved",
      icon: "✅",
    },
    pending: {
      bg: "rgba(245, 158, 11, 0.15)",
      text: "#f59e0b",
      label: "Pending",
      icon: "⏳",
    },
    rejected: {
      bg: "rgba(239, 68, 68, 0.15)",
      text: "#ef4444",
      label: "Rejected",
      icon: "❌",
    },
  };

  const style = statusStyles[station.status] || statusStyles.pending;

  return (
    <article
      style={{
        background: "rgba(248, 250, 252, 0.05)",
        backdropFilter: "blur(10px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
        transition: "all var(--transition-base)",
        transform: isOptimistic ? "scale(0.95)" : "scale(1)",
        opacity: isOptimistic ? 0.6 : 1,
        animation: `slideUp 0.5s ease-out ${index * 0.05}s both`,
        position: "relative",
      }}
      onMouseEnter={() => !isOptimistic && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="article"
      aria-label={`${station.name} station - ${station.status}`}
    >
      {/* Brand Placeholder */}
      <div
        style={{
          height: "120px",
          background: `linear-gradient(135deg, ${station.fast_charger ? "#f59e0b" : "#06b6d4"}, ${
            station.fast_charger ? "#d97706" : "#6366f1"
          })`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "48px",
          overflow: "hidden",
          position: "relative",
        }}
        aria-hidden="true"
      >
        {station.fast_charger ? "⚡" : "🔌"}
      </div>

      <div style={{ padding: "20px" }}>
        {/* Status Badge */}
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            background: style.bg,
            color: style.text,
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            marginBottom: "12px",
            boxShadow:
              station.status === "approved"
                ? `0 0 12px ${style.text}40`
                : "none",
          }}
          role="status"
        >
          {style.icon} {style.label}
        </div>

        {/* Station Name */}
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "700",
            color: "var(--color-surface)",
            lineHeight: "1.3",
          }}
        >
          {station.name}
        </h3>

        {/* Location */}
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            color: "var(--color-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          📍 {station.location}
        </p>

        {/* Coordinates with Copy */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "12px",
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        >
          <button
            onClick={() => onCopyCoord(`${station.latitude}`, "lat")}
            style={{
              background: "none",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "12px",
              transition: "all var(--transition-base)",
            }}
            title="Copy latitude"
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#6366f1";
              e.target.style.color = "#6366f1";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
              e.target.style.color = "var(--color-text-muted)";
            }}
          >
            {copiedCoord === "lat" ? "✓ Lat" : `Lat: ${station.latitude}`}
          </button>
          <button
            onClick={() => onCopyCoord(`${station.longitude}`, "lng")}
            style={{
              background: "none",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "12px",
              transition: "all var(--transition-base)",
            }}
            title="Copy longitude"
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#6366f1";
              e.target.style.color = "#6366f1";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
              e.target.style.color = "var(--color-text-muted)";
            }}
          >
            {copiedCoord === "lng" ? "✓ Lng" : `Lng: ${station.longitude}`}
          </button>
        </div>

        {/* Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
            padding: "12px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "12px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Slots
            </p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--color-surface)" }}>
              {station.total_slots}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Price
            </p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--color-surface)" }}>
              ₹{station.price_per_kwh}/kW
            </p>
          </div>
        </div>

        {/* Charger Type Badge */}
        {station.fast_charger && (
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              background: "rgba(245, 158, 11, 0.2)",
              color: "#f59e0b",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              marginBottom: "16px",
            }}
          >
            ⚡ DC Fast Charger
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => onEdit(station)}
            disabled={isOptimistic || station.status === "pending"}
            style={{
              flex: 1,
              padding: "12px 16px",
              background:
                station.status === "pending" || isOptimistic
                  ? "rgba(245, 158, 11, 0.2)"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.5), rgba(217, 119, 6, 0.5))",
              color: station.status === "pending" || isOptimistic ? "#f59e0b" : "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isOptimistic || station.status === "pending" ? "not-allowed" : "pointer",
              transition: "all var(--transition-base)",
              opacity: isOptimistic || station.status === "pending" ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isOptimistic && station.status !== "pending") {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 16px rgba(245, 158, 11, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            title={station.status === "pending" ? "Cannot edit pending stations" : "Edit station"}
          >
            ✏️ Edit
          </button>

          <button
            onClick={() => onDelete(station)}
            disabled={isOptimistic || station.status === "pending"}
            style={{
              flex: 1,
              padding: "12px 16px",
              background:
                station.status === "pending" || isOptimistic
                  ? "rgba(239, 68, 68, 0.2)"
                  : "linear-gradient(135deg, rgba(239, 68, 68, 0.6), rgba(220, 38, 38, 0.6))",
              color: station.status === "pending" || isOptimistic ? "#ef4444" : "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isOptimistic || station.status === "pending" ? "not-allowed" : "pointer",
              transition: "all var(--transition-base)",
              opacity: isOptimistic || station.status === "pending" ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isOptimistic && station.status !== "pending") {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 16px rgba(239, 68, 68, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            title={station.status === "pending" ? "Cannot delete pending stations" : "Delete station"}
          >
            🗑️ Delete
          </button>
        </div>

        {/* Optimistic Update Indicator */}
        {isOptimistic && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "rgba(99, 102, 241, 0.2)",
              color: "#6366f1",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              textAlign: "center",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            ⏳ Updating...
          </div>
        )}
      </div>
    </article>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeStyles = {
    success: {
      bg: "var(--color-success)",
      icon: "✅",
    },
    error: {
      bg: "var(--color-danger)",
      icon: "❌",
    },
    warning: {
      bg: "var(--color-warning)",
      icon: "⚠️",
    },
    info: {
      bg: "var(--color-primary-end)",
      icon: "ℹ️",
    },
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 9999,
        background: style.bg,
        color: "white",
        padding: "16px 24px",
        borderRadius: "12px",
        boxShadow: "var(--shadow-xl)",
        animation: "toastSlide 0.3s ease-out",
        maxWidth: "400px",
        fontWeight: "500",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "white",
          fontSize: "20px",
          cursor: "pointer",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}

function ConfirmModal({ modal, onConfirm, onCancel }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "overlayFade 0.2s ease-out",
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="modal-content"
        style={{
          background: "rgba(248, 250, 252, 0.05)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          padding: "32px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "var(--shadow-xl)",
          maxWidth: "500px",
          width: "90vw",
          animation: "slideUp 0.3s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 16px 0",
            fontSize: "22px",
            fontWeight: "700",
            color: "var(--color-surface)",
          }}
        >
          {modal.title}
        </h2>

        <p
          style={{
            margin: "0 0 32px 0",
            fontSize: "16px",
            color: "var(--color-text-muted)",
            lineHeight: "1.6",
          }}
        >
          {modal.message}
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 24px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "var(--color-surface)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all var(--transition-base)",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.1)";
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "12px 24px",
              background: "linear-gradient(135deg, var(--color-danger), #dc2626)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all var(--transition-base)",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 20px rgba(239, 68, 68, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
            }}
          >
            Delete Station
          </button>
        </div>
      </div>
    </div>
  );
}

// Maintainer notes:
// 1. Replace emoji icons with Lucide React icons (MapPin, Zap, Pencil, Trash2, Check)
//    - Update Icon imports and component renders
// 2. Adjust CSS variables for branding (colors, shadows, transitions)
// 3. Tune animation timings in @keyframes if desired
// 4. Add image placeholder for station brand/logo
// 5. Integrate with analytics/event tracking where marked
// 6. Consider implementing drag-to-reorder for station cards
// 7. Add filters (by status, charger type) above station list
// 8. Implement bulk actions (select multiple, delete/approve multiple)
// 9. Add station search and sorting by name/price/location
// 10. For large station lists, implement virtual scrolling (react-window)
// 11. Add "Copy all coordinates" feature for export
// 12. Consider integrating Google Maps embed for coordinates preview
// 13. Enhance form with location autocomplete via Maps API
// 14. Add before/after screenshot gallery for station approval