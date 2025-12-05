import React, { useEffect, useState, useRef } from "react";
import { MapPin, Zap, User, DollarSign, X, AlertCircle, CheckCircle } from "lucide-react";
import { getPendingStations, approveStation, rejectStation } from "../api/api";

export default function AdminStationApprovals() {
  const [stations, setStations] = useState([]);
  const [filteredStations, setFilteredStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fastChargerFilter, setFastChargerFilter] = useState("all");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toasts, setToasts] = useState([]);
  const [removingStationId, setRemovingStationId] = useState(null);
  const searchDebounceRef = useRef(null);
  const modalRef = useRef(null);

  const loadStations = async () => {
    setLoading(true);
    const res = await getPendingStations();
    if (!res.error) {
      setStations(res);
      setFilteredStations(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      let filtered = [...stations];

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.location.toLowerCase().includes(term) ||
            s.owner_name.toLowerCase().includes(term)
        );
      }

      if (fastChargerFilter !== "all") {
        const isFast = fastChargerFilter === "fast";
        filtered = filtered.filter((s) => s.fast_charger === isFast);
      }

      setFilteredStations(filtered);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, fastChargerFilter, stations]);

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleApprove = async (station) => {
    setRemovingStationId(station.id);

    setTimeout(async () => {
      const res = await approveStation(station.id);
      showToast(res.message || `${station.name} approved successfully!`, "success");
      await loadStations();
      setRemovingStationId(null);
    }, 400);
  };

  const openRejectModal = (station) => {
    setSelectedStation(station);
    setRejectModalOpen(true);
    setTimeout(() => {
      if (modalRef.current) {
        const textarea = modalRef.current.querySelector("textarea");
        if (textarea) textarea.focus();
      }
    }, 100);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setSelectedStation(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast("Please enter a rejection reason", "error");
      return;
    }

    setRemovingStationId(selectedStation.id);
    closeRejectModal();

    setTimeout(async () => {
      const res = await rejectStation(selectedStation.id, rejectReason);
      showToast(res.message || `${selectedStation.name} rejected`, "error");
      await loadStations();
      setRemovingStationId(null);
    }, 400);
  };

  const setQuickReason = (reason) => {
    setRejectReason(reason);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && rejectModalOpen) {
        closeRejectModal();
      }
    };

    if (rejectModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [rejectModalOpen]);

  const styles = {
    container: {
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    header: {
      maxWidth: "1200px",
      margin: "0 auto 32px",
    },
    title: {
      fontSize: "28px",
      fontWeight: "700",
      marginBottom: "8px",
      background: "var(--accent1)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    },
    subtitle: {
      color: "var(--muted)",
      fontSize: "14px",
      marginBottom: "24px",
    },
    controls: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center",
    },
    searchInput: {
      flex: "1 1 200px",
      minWidth: "200px",
      padding: "12px 16px",
      background: "var(--card)",
      border: "1px solid rgba(148, 163, 184, 0.2)",
      borderRadius: "12px",
      color: "var(--text)",
      fontSize: "14px",
      outline: "none",
      transition: "all 0.2s ease",
    },
    filterPill: (active) => ({
      padding: "10px 20px",
      background: active ? "var(--accent1)" : "var(--surface)",
      color: active ? "white" : "var(--muted)",
      border: "none",
      borderRadius: "20px",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
      outline: "none",
    }),
    gridContainer: {
      maxWidth: "1200px",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "20px",
    },
    card: (isRemoving) => ({
      background: "linear-gradient(135deg, var(--card) 0%, rgba(11, 18, 32, 0.8) 100%)",
      borderRadius: "16px",
      padding: "24px",
      border: "1px solid rgba(148, 163, 184, 0.1)",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: isRemoving ? "translateX(-100%) scale(0.8)" : "translateY(0)",
      opacity: isRemoving ? "0" : "1",
      cursor: "default",
    }),
    cardHighlight: {
      position: "absolute",
      top: "0",
      left: "50%",
      width: "200px",
      height: "200px",
      background: "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)",
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    },
    cardContent: {
      position: "relative",
      zIndex: "1",
    },
    cardHeader: {
      display: "flex",
      gap: "16px",
      marginBottom: "16px",
      alignItems: "flex-start",
    },
    iconWrapper: {
      width: "48px",
      height: "48px",
      borderRadius: "12px",
      background: "var(--accent1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
    },
    stationInfo: {
      flex: "1",
      minWidth: "0",
    },
    stationName: {
      fontSize: "20px",
      fontWeight: "600",
      marginBottom: "6px",
      color: "var(--text)",
      wordBreak: "break-word",
    },
    locationRow: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      color: "var(--muted)",
      fontSize: "14px",
      marginBottom: "4px",
    },
    detailsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "12px",
      marginBottom: "16px",
    },
    detailItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      color: "var(--muted)",
    },
    badges: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginBottom: "16px",
    },
    badge: (type) => ({
      padding: "6px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      background: type === "fast" ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
      color: type === "fast" ? "var(--success)" : "#6366f1",
      border: `1px solid ${type === "fast" ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
    }),
    actions: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
    },
    approveButton: {
      flex: "1",
      minWidth: "120px",
      padding: "14px 24px",
      background: "var(--accent1)",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
      outline: "none",
      position: "relative",
      overflow: "hidden",
    },
    rejectButton: {
      flex: "1",
      minWidth: "120px",
      padding: "14px 24px",
      background: "transparent",
      color: "var(--danger)",
      border: "2px solid var(--danger)",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
      outline: "none",
    },
    skeleton: {
      background: "linear-gradient(90deg, var(--card) 0%, rgba(148, 163, 184, 0.1) 50%, var(--card) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: "16px",
      height: "200px",
    },
    modal: {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "1000",
      padding: "20px",
      animation: "fadeIn 0.2s ease",
    },
    modalContent: {
      background: "var(--card)",
      borderRadius: "20px",
      padding: "32px",
      maxWidth: "500px",
      width: "100%",
      border: "1px solid rgba(148, 163, 184, 0.2)",
      animation: "scaleIn 0.2s ease",
      position: "relative",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
    },
    modalTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "var(--text)",
    },
    closeButton: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      padding: "8px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      minHeight: "44px",
      minWidth: "44px",
    },
    textarea: {
      width: "100%",
      minHeight: "120px",
      padding: "12px",
      background: "var(--bg)",
      border: "1px solid rgba(148, 163, 184, 0.2)",
      borderRadius: "12px",
      color: "var(--text)",
      fontSize: "14px",
      fontFamily: "inherit",
      resize: "vertical",
      outline: "none",
      marginBottom: "16px",
      transition: "all 0.2s ease",
    },
    quickReasons: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginBottom: "20px",
    },
    quickReasonChip: {
      padding: "8px 16px",
      background: "var(--surface)",
      border: "1px solid rgba(148, 163, 184, 0.2)",
      borderRadius: "20px",
      fontSize: "13px",
      color: "var(--muted)",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
      display: "flex",
      alignItems: "center",
    },
    modalActions: {
      display: "flex",
      gap: "12px",
    },
    cancelButton: {
      flex: "1",
      padding: "14px 24px",
      background: "var(--surface)",
      color: "var(--muted)",
      border: "none",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
    },
    sendButton: {
      flex: "1",
      padding: "14px 24px",
      background: "var(--danger)",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      minHeight: "44px",
    },
    toastContainer: {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "2000",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      maxWidth: "400px",
    },
    toast: (type) => ({
      padding: "16px 20px",
      background: type === "success" ? "rgba(16, 185, 129, 0.95)" : "rgba(239, 68, 68, 0.95)",
      color: "white",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      fontSize: "14px",
      fontWeight: "500",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      animation: "slideIn 0.3s ease",
      backdropFilter: "blur(8px)",
    }),
    emptyState: {
      textAlign: "center",
      padding: "60px 20px",
      color: "var(--muted)",
    },
    emptyStateIcon: {
      marginBottom: "16px",
      opacity: "0.5",
    },
  };

  const cssVariables = `
    :root {
      --bg: #0f1724;
      --card: #0b1220;
      --muted: #94a3b8;
      --accent1: linear-gradient(135deg, #06b6d4, #6366f1);
      --success: #10b981;
      --danger: #ef4444;
      --surface: rgba(15, 23, 36, 0.4);
      --text: #f1f5f9;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Hover effects - disable with prefers-reduced-motion */
    @media (prefers-reduced-motion: no-preference) {
      .card-hover:hover {
        transform: translateY(-6px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        border-color: rgba(6, 182, 212, 0.3);
      }

      .button-hover:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(6, 182, 212, 0.4);
      }

      .reject-button-hover:hover {
        background: var(--danger);
        color: white;
        transform: translateY(-2px);
      }

      .close-button-hover:hover {
        background: rgba(148, 163, 184, 0.1);
        color: var(--text);
      }

      .quick-reason-hover:hover {
        background: rgba(148, 163, 184, 0.1);
        border-color: rgba(148, 163, 184, 0.4);
        color: var(--text);
      }

      .filter-pill-hover:hover {
        transform: translateY(-2px);
      }

      .search-input-focus:focus {
        border-color: rgba(6, 182, 212, 0.5);
        box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
      }

      .textarea-focus:focus {
        border-color: rgba(6, 182, 212, 0.5);
        box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* Responsive grid */
    @media (min-width: 768px) {
      .grid-responsive {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Focus visible for accessibility */
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid #06b6d4;
      outline-offset: 2px;
    }
  `;

  return (
    <>
      <style>{cssVariables}</style>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Pending Station Approvals</h1>
          <p style={styles.subtitle}>
            Review and approve EV charging station submissions
          </p>

          <div style={styles.controls}>
            <input
              type="text"
              placeholder="Search by name, location, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
              className="search-input-focus"
              aria-label="Search stations"
            />
            <button
              onClick={() => setFastChargerFilter("all")}
              style={styles.filterPill(fastChargerFilter === "all")}
              className="filter-pill-hover"
              aria-label="Show all stations"
              aria-pressed={fastChargerFilter === "all"}
            >
              All
            </button>
            <button
              onClick={() => setFastChargerFilter("fast")}
              style={styles.filterPill(fastChargerFilter === "fast")}
              className="filter-pill-hover"
              aria-label="Show fast chargers only"
              aria-pressed={fastChargerFilter === "fast"}
            >
              Fast Chargers
            </button>
            <button
              onClick={() => setFastChargerFilter("standard")}
              style={styles.filterPill(fastChargerFilter === "standard")}
              className="filter-pill-hover"
              aria-label="Show standard chargers only"
              aria-pressed={fastChargerFilter === "standard"}
            >
              Standard
            </button>
          </div>
        </div>

        <div style={styles.gridContainer} className="grid-responsive">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={styles.skeleton}></div>
            ))}

          {!loading && filteredStations.length === 0 && (
            <div style={{ ...styles.emptyState, gridColumn: "1 / -1" }}>
              <div style={styles.emptyStateIcon}>
                <MapPin size={48} />
              </div>
              <p>No pending stations found</p>
            </div>
          )}

          {!loading &&
            filteredStations.map((station) => (
              <div
                key={station.id}
                style={styles.card(removingStationId === station.id)}
                className="card-hover"
              >
                <div style={styles.cardHighlight}></div>
                <div style={styles.cardContent}>
                  <div style={styles.cardHeader}>
                    <div style={styles.iconWrapper}>
                      {station.fast_charger ? (
                        <Zap size={24} color="white" />
                      ) : (
                        <MapPin size={24} color="white" />
                      )}
                    </div>
                    <div style={styles.stationInfo}>
                      <h3 style={styles.stationName}>{station.name}</h3>
                      <div style={styles.locationRow}>
                        <MapPin size={16} />
                        <span>{station.location}</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <User size={16} />
                      <span>{station.owner_name}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <DollarSign size={16} />
                      <span>₹{station.price_per_kwh}/kWh</span>
                    </div>
                  </div>

                  <div style={styles.detailItem} style={{ marginBottom: "16px", fontSize: "13px" }}>
                    <span>{station.owner_email}</span>
                  </div>

                  <div style={styles.badges}>
                    {station.fast_charger && (
                      <span style={styles.badge("fast")}>⚡ Fast Charger</span>
                    )}
                    <span style={styles.badge("slots")}>
                      {station.slots || 2} Slots
                    </span>
                  </div>

                  <div style={styles.actions}>
                    <button
                      onClick={() => handleApprove(station)}
                      style={styles.approveButton}
                      className="button-hover"
                      aria-label={`Approve ${station.name}`}
                    >
                      <CheckCircle size={18} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
                      Approve
                    </button>
                    <button
                      onClick={() => openRejectModal(station)}
                      style={styles.rejectButton}
                      className="reject-button-hover"
                      aria-label={`Reject ${station.name}`}
                    >
                      <AlertCircle size={18} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {rejectModalOpen && (
          <div
            style={styles.modal}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeRejectModal();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div style={styles.modalContent} ref={modalRef}>
              <div style={styles.modalHeader}>
                <h2 id="modal-title" style={styles.modalTitle}>
                  Reject Station
                </h2>
                <button
                  onClick={closeRejectModal}
                  style={styles.closeButton}
                  className="close-button-hover"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
                Rejecting: <strong style={{ color: "var(--text)" }}>{selectedStation?.name}</strong>
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                style={styles.textarea}
                className="textarea-focus"
                aria-label="Rejection reason"
              />

              <div style={{ marginBottom: "8px", fontSize: "13px", color: "var(--muted)" }}>
                Quick reasons:
              </div>
              <div style={styles.quickReasons}>
                <button
                  onClick={() => setQuickReason("Safety concerns identified")}
                  style={styles.quickReasonChip}
                  className="quick-reason-hover"
                >
                  Safety
                </button>
                <button
                  onClick={() => setQuickReason("Required documentation missing")}
                  style={styles.quickReasonChip}
                  className="quick-reason-hover"
                >
                  Docs Missing
                </button>
                <button
                  onClick={() => setQuickReason("Incorrect location information")}
                  style={styles.quickReasonChip}
                  className="quick-reason-hover"
                >
                  Incorrect Location
                </button>
              </div>

              <div style={styles.modalActions}>
                <button
                  onClick={closeRejectModal}
                  style={styles.cancelButton}
                  className="button-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  style={styles.sendButton}
                  className="button-hover"
                >
                  Send Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={styles.toastContainer} aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} style={styles.toast(toast.type)} role="alert">
              {toast.type === "success" ? (
                <CheckCircle size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
