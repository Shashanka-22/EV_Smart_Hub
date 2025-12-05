import React, { useState, useEffect, useCallback, memo } from "react";
import {
  getOwnerReservations,
  ownerCancelReservation,
  startCharging,
  stopCharging,
} from "../api/api";
import {
  Zap,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  StopCircle,
  Trash2,
  Loader2,
} from "lucide-react";

/**
 * OwnerReservations - Dark themed (navy → teal → indigo → emerald)
 * Updated to match the screenshot style: dark navy background, glassy dark cards,
 * bright teal→indigo gradients and emerald accents. All logic unchanged.
 *
 * Drop-in replace your existing file with this one.
 */

const OwnerReservations = () => {
  const [stations, setStations] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [fadeIn, setFadeIn] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
    loading: false,
  });

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  // Fetch reservations for owner's stations
  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOwnerReservations();
      if (data?.error) {
        console.error("Error fetching reservations:", data.error);
        setStations([]);
        showToast("Failed to load reservations", "error");
      } else {
        setStations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching reservations:", err);
      setStations([]);
      showToast("Network error occurred", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    setFadeIn(true);
    const refresher = setInterval(() => fetchReservations(), 60000);
    return () => clearInterval(refresher);
  }, [fetchReservations]);

  // Countdown clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast system
  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  // Confirmation modal
  const openConfirmModal = (message, onConfirm) => {
    setConfirmModal({ isOpen: true, message, onConfirm, loading: false });
  };

  const closeConfirmModal = () => {
    if (!confirmModal.loading) {
      setConfirmModal({ isOpen: false, message: "", onConfirm: null, loading: false });
    }
  };

  const handleConfirm = async () => {
    if (confirmModal.onConfirm) {
      setConfirmModal((prev) => ({ ...prev, loading: true }));
      try {
        await confirmModal.onConfirm();
      } finally {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null, loading: false });
      }
    }
  };

  // Cancel reservation (owner)
  const handleCancel = (reservationId) => {
    openConfirmModal(
      "Are you sure you want to cancel this reservation? This action cannot be undone.",
      async () => {
        try {
          const res = await ownerCancelReservation(reservationId);
          if (!res?.error) {
            showToast("Reservation cancelled successfully", "success");
            await fetchReservations();
          } else {
            showToast(res.error || "Failed to cancel", "error");
          }
        } catch (err) {
          console.error("Cancel error:", err);
          showToast("Failed to cancel reservation", "error");
        }
      }
    );
  };

  // Start charging
  const handleStartCharging = async (reservationId) => {
    try {
      const res = await startCharging({ reservation_id: reservationId });
      if (!res?.error) {
        showToast("Charging started successfully", "success");
        fetchReservations();
      } else {
        showToast(res.error || "Failed to start charging", "error");
      }
    } catch (err) {
      console.error("Start error:", err);
      showToast("Failed to start charging", "error");
    }
  };

  // Stop charging
  const handleStopCharging = async (reservationId) => {
    try {
      const res = await stopCharging({ reservation_id: reservationId });
      if (!res?.error) {
        showToast("Charging stopped successfully", "success");
        fetchReservations();
      } else {
        showToast(res.error || "Failed to stop charging", "error");
      }
    } catch (err) {
      console.error("Stop error:", err);
      showToast("Failed to stop charging", "error");
    }
  };

  // Format IST datetime
  const formatIST = (datetime) => {
    if (!datetime) return "-";
    return new Date(datetime).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Countdown for expiry / charging
  const getCountdown = (targetTime) => {
    if (!targetTime) return "-";
    const diff = new Date(targetTime) - now;
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  // Keyboard handler for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (confirmModal.isOpen) {
        if (e.key === "Escape") closeConfirmModal();
        if (e.key === "Enter") handleConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal]);

  return (
    <>
      <style>{`
        :root{
          /* Dark brand tokens (navy base, teal→indigo gradient, emerald accents) */
          --bg: #071225;                 /* deep navy */
          --panel: rgba(10,18,28,0.65);  /* dark glass panel */
          --panel-border: rgba(255,255,255,0.04);
          --surface-soft: rgba(255,255,255,0.03);
          --text-inverse: #e6eef6;
          --muted: #93a4b8;
          --primary-from: #06b6d4; /* teal */
          --primary-to: #6366f1;   /* indigo */
          --primary-gradient: linear-gradient(135deg, var(--primary-from), var(--primary-to));
          --accent: #10b981; /* emerald */
          --warning: #f59e0b;
          --danger: #ef4444;
          --glass-glow: 0 8px 30px rgba(6,182,212,0.06);
          --radius-lg: 14px;
          --radius-md: 10px;
          --shadow-deep: 0 12px 40px rgba(2,8,23,0.6);
        }

        * { box-sizing: border-box; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }

        .owner-wrapper {
          min-height: 100vh;
          background: radial-gradient(1200px 400px at 10% 10%, rgba(6,182,212,0.06), transparent 8%),
                      radial-gradient(800px 300px at 90% 80%, rgba(99,102,241,0.045), transparent 8%),
                      linear-gradient(180deg, var(--bg) 0%, #0b1724 100%);
          color: var(--text-inverse);
          padding: 32px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
        }

        .header {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .title-block {
          display:flex;
          gap:14px;
          align-items:center;
        }

        .brand-badge {
          width:56px;
          height:56px;
          border-radius:12px;
          display:flex;
          align-items:center;
          justify-content:center;
          background: linear-gradient(135deg, rgba(6,182,212,0.1), rgba(99,102,241,0.08));
          box-shadow: var(--glass-glow);
          border: 1px solid rgba(255,255,255,0.03);
        }

        .page-title {
          font-size: clamp(1.6rem, 3.2vw, 2.4rem);
          font-weight: 800;
          margin: 0;
          background: var(--primary-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .page-sub {
          color: var(--muted);
          font-size: 0.95rem;
          margin-top: 4px;
        }

        /* Live indicator */
        .top-bar {
          display:flex;
          gap:12px;
          align-items:center;
        }

        .live-pill {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          background: linear-gradient(90deg, rgba(6,182,212,0.06), rgba(99,102,241,0.03));
          border-radius:999px;
          color: var(--accent);
          font-weight:700;
          border: 1px solid rgba(6,182,212,0.08);
        }

        /* filters */
        .filters {
          display:flex;
          gap:12px;
          margin: 20px 0 26px;
          flex-wrap:wrap;
          align-items:center;
        }

        .pill {
          padding:10px 16px;
          border-radius:999px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.04);
          color: var(--text-inverse);
          font-weight:600;
          cursor:pointer;
          transition: all 180ms ease;
        }

        .pill:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(2,6,23,0.45); }
        .pill.active {
          background: linear-gradient(90deg, rgba(6,182,212,0.14), rgba(99,102,241,0.12));
          border: 1px solid rgba(6,182,212,0.22);
          color: var(--text-inverse);
          box-shadow: 0 8px 28px rgba(99,102,241,0.12);
        }

        /* station card - dark glass */
        .station-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: var(--radius-lg);
          padding: 16px;
          margin-bottom: 20px;
          box-shadow: 0 8px 30px rgba(2,6,23,0.6);
          overflow: hidden;
          transition: transform .22s ease, box-shadow .22s ease;
        }

        .station-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-deep);
        }

        .station-header {
          display:flex;
          gap:14px;
          align-items:center;
          padding: 8px 4px;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }

        .station-icon {
          width:64px;
          height:64px;
          border-radius:12px;
          display:flex;
          align-items:center;
          justify-content:center;
          background: linear-gradient(135deg, var(--primary-from), var(--primary-to));
          color: white;
          box-shadow: 0 12px 40px rgba(6,182,212,0.08);
          flex-shrink: 0;
        }

        .station-meta { flex:1; min-width:0; }
        .station-name { font-weight:800; font-size:1.05rem; color:var(--text-inverse); margin:0; }
        .station-location { color:var(--muted); display:flex; gap:8px; align-items:center; margin-top:6px; font-size:0.9rem; }

        .station-stats { display:flex; gap:10px; margin-left:auto; align-items:center; }
        .stat-pill {
          padding:8px 12px;
          border-radius:999px;
          background: rgba(255,255,255,0.03);
          color: var(--muted);
          font-weight:700;
          display:inline-flex;
          gap:8px;
          align-items:center;
        }
        .stat-pill .dot { width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow: 0 6px 18px rgba(16,185,129,0.08); }

        /* table area */
        .table-wrap {
          margin-top: 12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005));
          border-radius: 12px;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.03);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: linear-gradient(180deg, rgba(6,11,20,0.6), rgba(6,11,20,0.55));
          padding: 12px;
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          font-weight: 700;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }

        tbody td {
          padding: 14px 12px;
          color: var(--text-inverse);
          font-size: 0.95rem;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          text-align: center;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: linear-gradient(90deg, rgba(6,182,212,0.02), rgba(99,102,241,0.02));
          transform: none;
        }

        /* badges and countdowns styled for dark */
        .status-badge {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          color:white;
          font-weight:800;
          font-size:0.82rem;
        }
        .status-badge.charging { background: linear-gradient(90deg,#3b82f6,#6366f1) }
        .status-badge.active { background: linear-gradient(90deg,#10b981,#059669) }
        .status-badge.completed { background: linear-gradient(90deg,#10b981,#059669) }
        .status-badge.expired { background: linear-gradient(90deg,#ef4444,#dc2626) }

        .countdown-badge {
          padding:8px 12px;
          border-radius:999px;
          font-weight:800;
          color:white;
          background: linear-gradient(90deg,var(--primary-from),var(--primary-to));
          box-shadow: 0 10px 30px rgba(99,102,241,0.08);
          display:inline-block;
          min-width:88px;
          text-align:center;
        }
        .countdown-badge.expired { background: linear-gradient(90deg,#ef4444,#dc2626) }

        /* action buttons */
        .actions-cell { display:flex; gap:8px; justify-content:center; align-items:center; flex-wrap:wrap; }
        .action-btn {
          padding:10px 14px;
          border-radius:12px;
          border:none;
          cursor:pointer;
          color:white;
          font-weight:800;
          min-width:100px;
          display:inline-flex;
          gap:8px;
          align-items:center;
          justify-content:center;
          transition: transform .14s ease, box-shadow .14s ease;
        }
        .action-btn.start { background: linear-gradient(90deg,#10b981,#059669); box-shadow: 0 10px 30px rgba(16,185,129,0.08); }
        .action-btn.stop { background: linear-gradient(90deg,#f59e0b,#d97706); box-shadow: 0 10px 30px rgba(245,158,11,0.06); }
        .action-btn.cancel { background: linear-gradient(90deg,#ef4444,#dc2626); box-shadow: 0 10px 30px rgba(239,68,68,0.06); }
        .action-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .action-btn:hover:not(:disabled) { transform: translateY(-4px); }

        /* modal */
        .modal-overlay {
          position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
          background: linear-gradient(180deg, rgba(2,6,23,0.6), rgba(2,6,23,0.6));
          z-index:1200;
          padding: 20px;
        }
        .modal {
          width:100%; max-width:520px; background: linear-gradient(180deg, rgba(14,22,33,0.95), rgba(10,16,24,0.95));
          border-radius:14px; padding:20px; border: 1px solid rgba(255,255,255,0.04); box-shadow: 0 30px 90px rgba(2,6,23,0.8);
        }
        .modal h3 { margin:0 0 8px; color:var(--text-inverse); }
        .modal p { margin:0 0 18px; color:var(--muted); }

        .modal-actions { display:flex; gap:10px; justify-content:flex-end; }
        .btn-ghost {
          padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.03); background: transparent; color:var(--muted);
        }
        .btn-primary {
          padding:10px 14px; border-radius:10px; border:none; color:white;
          background: linear-gradient(90deg,var(--primary-from),var(--primary-to));
          box-shadow: 0 10px 30px rgba(99,102,241,0.08);
          font-weight:800;
        }

        /* toast */
        .toast-wrap { position:fixed; top:20px; right:20px; display:flex; flex-direction:column; gap:12px; z-index:1300; }
        .toast {
          min-width:300px; max-width:420px; padding:12px 14px; border-radius:12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.03);
          display:flex; gap:12px; align-items:center; color:var(--text-inverse);
          box-shadow: 0 18px 60px rgba(2,6,23,0.6);
        }
        .toast .icon { width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; }
        .toast.success .icon { background: rgba(16,185,129,0.12); color: var(--accent); }
        .toast.error .icon { background: rgba(239,68,68,0.08); color: var(--danger); }
        .toast.info .icon { background: rgba(99,102,241,0.08); color: var(--primary-to); }
        .toast .text { font-weight:700; color:var(--text-inverse); }

        /* responsive tweaks */
        @media (max-width: 980px) {
          table { min-width: 760px; }
        }
        @media (max-width: 720px) {
          .table-wrap { overflow-x: auto; }
          table { min-width: 640px; }
          .header { flex-direction:column; align-items:flex-start; gap:12px; }
          .station-header { flex-direction:column; align-items:flex-start; gap:10px; }
        }
      `}</style>

      <div className="owner-wrapper">
        <div className="container" style={{ opacity: fadeIn ? 1 : 0, transition: "opacity .45s ease" }}>
          <div className="header">
            <div className="title-block">
              <div className="brand-badge" aria-hidden>
                <Zap size={28} color="white" />
              </div>
              <div>
                <div className="page-title">Charging Stations — Owner Dashboard</div>
                <div className="page-sub">Monitor, control and manage reservations in real-time</div>
              </div>
            </div>

            <div className="top-bar">
              <div className="live-pill"><Loader2 size={16} /> Live Updates Active</div>
            </div>
          </div>

          <div className="filters" role="tablist" aria-label="Reservation filters">
            {["all", "active", "charging", "expired"].map((p) => (
              <button
                key={p}
                className={`pill ${filter === p ? "active" : ""}`}
                onClick={() => setFilter(p)}
                aria-pressed={filter === p}
              >
                {p}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ marginTop: 24 }} className="station-card">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: "linear-gradient(90deg,#06b6d4,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 size={26} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Loading reservations...</div>
                  <div style={{ color: "var(--muted)" }}>Fetching latest station & reservation data</div>
                </div>
              </div>
            </div>
          ) : stations.length === 0 ? (
            <div className="station-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44 }}>🔌</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>No stations found</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Add stations or wait for live data to appear.</div>
            </div>
          ) : (
            stations.map((station) => {
              const filteredReservations = (station.reservations || []).filter((r) => {
                if (filter === "all") return true;
                if (filter === "charging") return r.charging_status === "running";
                if (filter === "expired") return r.status === "expired";
                if (filter === "active") return r.status === "active" && r.charging_status !== "running";
                return true;
              });

              return (
                <section className="station-card" key={station.station_id} aria-labelledby={`s-${station.station_id}`}>
                  <div className="station-header">
                    <div className="station-icon" aria-hidden>
                      <Zap size={28} />
                    </div>

                    <div className="station-meta">
                      <div className="station-name">{station.station_name || `Station #${station.station_id}`}</div>
                      <div className="station-location"><MapPin size={14} /> {station.station_location || "Location unavailable"}</div>
                    </div>

                    <div className="station-stats">
                      <div className="stat-pill"><span style={{ color: "var(--muted)" }}>Reserved</span> <strong style={{ marginLeft: 6 }}>{station.reserved_slots ?? 0}</strong></div>
                      <div className="stat-pill"><span style={{ color: "var(--muted)" }}>Available</span> <strong style={{ marginLeft: 6, color: "var(--accent)" }}>{station.available_slots ?? 0}</strong></div>
                    </div>
                  </div>

                  <div className="table-wrap" role="region" aria-label={`${station.station_name} reservations`}>
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Email</th>
                          <th>ETA</th>
                          <th>Expiry</th>
                          <th>Charging End</th>
                          <th>Time Remaining</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredReservations.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ padding: 30, color: "var(--muted)" }}>
                              🔎 No reservations match this filter
                            </td>
                          </tr>
                        ) : (
                          filteredReservations.map((r) => {
                            const isCharging = r.charging_status === "running";
                            const isCompleted = r.charging_status === "completed";
                            const countdown = isCharging ? getCountdown(r.charging_end_time) : getCountdown(r.expire_time);

                            return (
                              <ReservationRow
                                key={r.reservation_id}
                                reservation={r}
                                isCharging={isCharging}
                                isCompleted={isCompleted}
                                countdown={countdown}
                                formatIST={formatIST}
                                onStartCharging={handleStartCharging}
                                onStopCharging={handleStopCharging}
                                onCancel={handleCancel}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}

          {/* Confirmation Modal */}
          {confirmModal.isOpen && (
            <div className="modal-overlay" onClick={closeConfirmModal} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3 id="confirm-title">Confirm action</h3>
                <p style={{ color: "var(--muted)" }}>{confirmModal.message}</p>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={closeConfirmModal} disabled={confirmModal.loading}>Cancel</button>
                  <button className="btn-primary" onClick={handleConfirm} disabled={confirmModal.loading}>
                    {confirmModal.loading ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toasts */}
          <div className="toast-wrap" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.type}`}>
                <div className="icon">
                  {t.type === "success" ? <CheckCircle size={18} /> : t.type === "error" ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="text">{t.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

/* Memoized Reservation Row for performance */
const ReservationRow = memo(({
  reservation: r,
  isCharging,
  isCompleted,
  countdown,
  formatIST,
  onStartCharging,
  onStopCharging,
  onCancel,
}) => {
  return (
    <tr>
      <td style={{ fontWeight: 800 }}>{r.username || "—"}</td>
      <td style={{ color: "var(--muted)", fontSize: 13 }}>{r.user_email || "—"}</td>
      <td style={{ fontSize: 13 }}>{formatIST(r.eta_time)}</td>
      <td style={{ fontSize: 13 }}>{formatIST(r.expire_time)}</td>
      <td style={{ fontSize: 13 }}>{isCharging || isCompleted ? formatIST(r.charging_end_time) : "-"}</td>
      <td>
        <span className={`countdown-badge ${countdown === "Expired" ? "expired" : ""}`}>{countdown}</span>
      </td>
      <td>
        <span className={`status-badge ${
          isCharging ? "charging" : isCompleted ? "completed" : r.status === "active" ? "active" : "expired"
        }`}>
          {isCharging ? "Charging" : isCompleted ? "Completed" : (r.status || "").toUpperCase()}
        </span>
      </td>
      <td>
        <div className="actions-cell">
          {r.status === "active" && !isCharging && (
            <>
              <button className="action-btn start" onClick={() => onStartCharging(r.reservation_id)} aria-label={`Start charging for ${r.username}`}>
                <Play size={14} /> Start
              </button>
              <button className="action-btn cancel" onClick={() => onCancel(r.reservation_id)} aria-label={`Cancel reservation for ${r.username}`}>
                <Trash2 size={14} /> Cancel
              </button>
            </>
          )}

          {isCharging && (
            <button className="action-btn stop" onClick={() => onStopCharging(r.reservation_id)} aria-label={`Stop charging for ${r.username}`}>
              <StopCircle size={14} /> Stop
            </button>
          )}

          {isCompleted && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Completed</span>}
        </div>
      </td>
    </tr>
  );
});

ReservationRow.displayName = "ReservationRow";

export default OwnerReservations;
