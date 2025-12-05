import React, { useEffect, useState, useRef } from "react";
import {
  Battery,
  Clock,
  MapPin,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  Copy,
  Wifi,
  WifiOff,
  ChevronDown,
} from "lucide-react";

// 🔌 API IMPORTS - Replace with your actual API module
import { getMyReservations, cancelReservation } from "../api/api";

/**
 * MyReservations - Dark glass theme consistent with other pages
 */
const MyReservations = () => {
  // State
  const [activeReservations, setActiveReservations] = useState([]);
  const [pastReservations, setPastReservations] = useState([]);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Toast/Modal
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  const toastIdCounter = useRef(0);
  const scrollRef = useRef(null);

  // Network monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast("Back online! Refreshing data...", "success");
      fetchReservations();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("You're offline. Some features may be limited.", "warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data fetch
  const fetchReservations = async () => {
    try {
      const res = await getMyReservations();
      if (res && Array.isArray(res)) {
        setActiveReservations(
          res.filter((r) => r.status === "active" || r.charging_status === "running")
        );
        setPastReservations(
          res.filter((r) => r.status === "past" || r.charging_status === "completed")
        );
      } else {
        setActiveReservations([]);
        setPastReservations([]);
      }
    } catch (err) {
      console.error("Failed to load reservations", err);
      addToast("Failed to load reservations. Please try again.", "error");
      setActiveReservations([]);
      setPastReservations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
    setFadeIn(true);
    const clock = setInterval(() => setNow(new Date()), 10000);
    const refresher = setInterval(() => fetchReservations(), 60000);
    return () => {
      clearInterval(clock);
      clearInterval(refresher);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sticky summary bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) setShowStickyBar(true);
      else setShowStickyBar(false);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Toast system
  const addToast = (message, type = "info", duration = 5000) => {
    const id = toastIdCounter.current++;
    const newToast = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Cancel reservation (optimistic)
  const handleCancel = async (reservation) => {
    setConfirmModal({
      title: "Cancel Reservation?",
      message: `Are you sure you want to cancel your reservation at ${reservation.station_name || `Station #${reservation.station_id}`}?`,
      onConfirm: async () => {
        setConfirmModal(null);
        const originalActive = [...activeReservations];
        setActiveReservations((prev) => prev.filter((r) => r.id !== reservation.id));
        const toastId = addToast("Cancelling reservation...", "info", 0);

        try {
          await cancelReservation(reservation.id);
          removeToast(toastId);
          addToast("Reservation cancelled successfully!", "success");
          // refresh
          fetchReservations();
        } catch (err) {
          console.error("Cancel failed:", err);
          setActiveReservations(originalActive);
          removeToast(toastId);
          addToast("Failed to cancel. Please try again.", "error");
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  // Navigate
  const handleNavigate = (lat, lng, stationName) => {
    if (!lat || !lng) {
      addToast("Location not available for this station.", "warning");
      return;
    }
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(mapsUrl, "_blank");
    addToast("Opening Google Maps...", "info", 2000);
  };

  // Copy details
  const handleCopy = async (reservation) => {
    const details = `
🔋 EV Charging Reservation
━━━━━━━━━━━━━━━━━━━━━━━
🚉 Station: ${reservation.station_name || `Station #${reservation.station_id}`}
📍 Location: ${reservation.latitude}, ${reservation.longitude}
⏱️ ETA: ${formatDate(reservation.eta_time)}
⏰ Expires: ${formatDate(reservation.expire_time)}
📅 Reserved: ${formatDate(reservation.created_at)}
📊 Status: ${reservation.charging_status === "running" ? "Charging" : reservation.status}
    `.trim();

    try {
      await navigator.clipboard.writeText(details);
      addToast("Reservation details copied!", "success", 2000);
    } catch (err) {
      addToast("Failed to copy details.", "error");
    }
  };

  // Countdown
  const getCountdown = (targetTime) => {
    const diff = new Date(targetTime) - now;
    if (diff <= 0) return { text: "Expired", expired: true };

    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const text = hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
    return { text, expired: false, hrs, mins, secs };
  };

  // Date format
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Reservation card
  const ReservationCard = ({ reservation, type }) => {
    const isCharging = reservation.charging_status === "running";
    const isCompleted = reservation.charging_status === "completed";

    let countdown = null;
    let expired = false;

    if (type === "active") {
      if (isCharging) {
        const cd = getCountdown(reservation.charging_end_time);
        countdown = cd.text;
        expired = cd.expired;
      } else {
        const cd = getCountdown(reservation.expire_time);
        countdown = cd.text;
        expired = cd.expired;
      }
    }

    const getStatusInfo = () => {
      if (isCompleted) return { text: "Completed", color: "rgba(255,255,255,0.06)", textColor: "var(--muted-on-dark)" };
      if (type === "past") return { text: "Past", color: "rgba(255,255,255,0.04)", textColor: "var(--muted-on-dark)" };
      if (isCharging) return { text: "Charging", color: "linear-gradient(135deg, var(--color-charging), #059669)", textColor: "var(--text-on-dark)" };
      if (expired) return { text: "Expired", color: "linear-gradient(135deg, var(--color-warning), #d97706)", textColor: "var(--text-on-dark)" };
      return { text: "Active", color: "linear-gradient(135deg, var(--color-charging), #16a34a)", textColor: "var(--text-on-dark)" };
    };

    const statusInfo = getStatusInfo();

    return (
      <div className="reservation-card" role="article" aria-label={`Reservation at ${reservation.station_name || reservation.station_id}`}>
        <div className="card-header">
          <div className="station-avatar" aria-hidden>
            <Zap size={24} strokeWidth={2.5} />
          </div>

          <div className="card-header-info">
            <h3 className="station-name">{reservation.station_name || `Station #${reservation.station_id}`}</h3>
            <div
              className="status-badge"
              style={{
                background: typeof statusInfo.color === "string" && statusInfo.color.startsWith("linear") ? undefined : statusInfo.color,
                backgroundImage: typeof statusInfo.color === "string" && statusInfo.color.startsWith("linear") ? statusInfo.color : undefined,
                color: statusInfo.textColor || "var(--text-on-dark)",
              }}
            >
              {statusInfo.text}
            </div>
          </div>

          <button
            className="icon-btn"
            onClick={() => handleCopy(reservation)}
            aria-label="Copy reservation details"
            title="Copy details"
          >
            <Copy size={18} />
          </button>
        </div>

        <div className="card-body">
          <div className="info-row">
            <div className="info-label">
              <Clock size={16} />
              <span>ETA</span>
            </div>
            <div className="info-value">{formatDate(reservation.eta_time)}</div>
          </div>

          {isCharging ? (
            <>
              <div className="info-row">
                <div className="info-label">
                  <Battery size={16} />
                  <span>Charging Ends</span>
                </div>
                <div className="info-value">{formatDate(reservation.charging_end_time)}</div>
              </div>

              <div className="info-row countdown-row">
                <div className="info-label">
                  <AlertCircle size={16} />
                  <span>Time Left</span>
                </div>
                <div className="countdown-chip charging">
                  <span className="countdown-text">{countdown}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="info-row">
                <div className="info-label">
                  <AlertCircle size={16} />
                  <span>{type === "active" ? "Expires At" : "Expired At"}</span>
                </div>
                <div className="info-value">{formatDate(reservation.expire_time)}</div>
              </div>

              {type === "active" && countdown && (
                <div className="info-row countdown-row">
                  <div className="info-label">
                    <Clock size={16} />
                    <span>Remaining</span>
                  </div>
                  <div className={`countdown-chip ${expired ? "expired" : ""}`}>
                    <span className="countdown-text">{countdown}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="info-row">
            <div className="info-label">
              <Calendar size={16} />
              <span>Reserved At</span>
            </div>
            <div className="info-value">{formatDate(reservation.created_at)}</div>
          </div>
        </div>

        {type === "active" && !isCharging && (
          <div className="card-actions">
            <button
              className="btn btn-navigate"
              disabled={expired}
              onClick={() => handleNavigate(reservation.latitude, reservation.longitude, reservation.station_name)}
              aria-label="Navigate to station"
            >
              <MapPin size={18} />
              Navigate
            </button>

            <button
              className="btn btn-cancel"
              disabled={expired}
              onClick={() => handleCancel(reservation)}
              aria-label="Cancel reservation"
            >
              <XCircle size={18} />
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="reservation-card skeleton-card" aria-hidden>
      <div className="skeleton skeleton-header" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </div>
  );

  // Empty
  const EmptyState = ({ type }) => (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-icon">{type === "active" ? <Battery size={64} /> : <Calendar size={64} />}</div>
      <h3 className="empty-title">{type === "active" ? "No Active Reservations" : "No Past Reservations"}</h3>
      <p className="empty-description">
        {type === "active"
          ? "You don't have any active EV charging reservations at the moment."
          : "Your completed charging sessions will appear here."}
      </p>
    </div>
  );

  // Toast
  const Toast = ({ toast }) => {
    const icons = {
      success: <CheckCircle size={20} />,
      error: <XCircle size={20} />,
      warning: <AlertCircle size={20} />,
      info: <AlertCircle size={20} />,
    };

    return (
      <div className={`toast toast-${toast.type}`} role="alert" aria-live="polite">
        <div className="toast-icon">{icons[toast.type]}</div>
        <div className="toast-message">{toast.message}</div>
        <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Close notification">
          <XCircle size={18} />
        </button>
      </div>
    );
  };

  // Confirm modal keyboard handlers
  useEffect(() => {
    if (!confirmModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") confirmModal.onCancel();
      else if (e.key === "Enter") confirmModal.onConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal]);

  return (
    <>
      <style>{`
        /* Root tokens - dark glass + cyan/indigo + green accents */
        :root {
          --bg-start: #071024; /* deep navy */
          --bg-end: #0f2b3f;   /* slightly lighter navy */
          --card-glass: rgba(255,255,255,0.04);
          --card-border: rgba(255,255,255,0.06);

          --color-primary-start: #06b6d4; /* cyan */
          --color-primary-end: #6366f1;   /* indigo */
          --color-charging: #10b981;      /* emerald green */
          --color-warning: #f59e0b;
          --color-danger: #ef4444;

          --text-on-dark: #e6eef6;
          --muted-on-dark: #9fb3c7;

          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --radius-xl: 20px;

          --spacing-xs: 6px;
          --spacing-sm: 12px;
          --spacing-md: 16px;
          --spacing-lg: 24px;
          --spacing-xl: 32px;

          --shadow-sm: 0 4px 18px rgba(2,6,23,0.6);
          --shadow-md: 0 12px 40px rgba(2,6,23,0.65);
          --shadow-xl: 0 30px 80px rgba(2,6,23,0.72);

          --animation-fast: 150ms;
          --animation-normal: 300ms;
          --animation-slow: 480ms;
          --animation-ease: cubic-bezier(0.33, 1, 0.68, 1);
        }

        /* Base */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .my-reservations-container {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg-start), var(--bg-end));
          padding: var(--spacing-lg);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: var(--text-on-dark);
          animation: fadeInUp var(--animation-slow) var(--animation-ease);
        }

        /* Sticky summary bar */
        .sticky-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: rgba(8,20,34,0.6);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1200;
          box-shadow: var(--shadow-sm);
          transform: translateY(-110%);
          transition: transform var(--animation-normal) var(--animation-ease);
        }
        .sticky-bar.visible { transform: translateY(0); }

        .sticky-bar-content { display:flex; align-items:center; gap:12px; }
        .sticky-bar-badge {
          background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          color: #021018;
          padding: 6px 14px;
          border-radius: 9999px;
          font-weight: 700;
        }
        .offline-indicator {
          display:flex; gap:8px; align-items:center;
          background: rgba(239,68,68,0.08); color: var(--color-warning);
          padding: 6px 12px; border-radius: 9999px; font-weight:600;
        }

        /* Header */
        .header { text-align:center; margin-bottom: 48px; }
        .header-title {
          display:flex; align-items:center; justify-content:center; gap: 18px;
          font-size: clamp(20px, 4vw, 32px); font-weight:800;
          background: linear-gradient(135deg, var(--color-charging), var(--color-primary-start));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .header-divider {
          width: 96px; height:4px; margin: 16px auto; border-radius:6px;
          background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          box-shadow: 0 6px 18px rgba(6,182,212,0.08);
        }
        .header-subtitle { color: var(--muted-on-dark); margin-top: 6px; }

        /* Sections */
        .section { margin-bottom: 40px; }
        .section-title { display:flex; gap:12px; align-items:center; font-size:20px; font-weight:700; color:var(--text-on-dark); margin-bottom: 16px; }
        .cards-grid { display:grid; grid-template-columns: 1fr; gap: 20px; }

        /* Reservation card - glass */
        .reservation-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: var(--radius-lg);
          padding: 18px;
          box-shadow: var(--shadow-md);
          backdrop-filter: blur(8px);
          transition: transform var(--animation-normal) var(--animation-ease), box-shadow var(--animation-normal);
        }
        .reservation-card:hover { transform: translateY(-6px); box-shadow: var(--shadow-xl); }

        .card-header { display:flex; gap:16px; align-items:flex-start; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 14px; }
        .station-avatar {
          width:56px; height:56px; border-radius: 12px;
          background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          display:flex; align-items:center; justify-content:center; color: #021018;
          flex-shrink:0; box-shadow: 0 8px 26px rgba(6,182,212,0.06);
        }
        .card-header-info { flex:1; min-width: 0; }
        .station-name { font-size: 18px; font-weight:700; color: var(--text-on-dark); margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .status-badge {
          display:inline-flex; align-items:center; padding:6px 12px; border-radius:9999px; font-weight:700; font-size:12px; color:var(--text-on-dark);
          box-shadow: 0 6px 18px rgba(2,6,23,0.5);
        }

        .icon-btn {
          background: rgba(255,255,255,0.02); border: none; border-radius: 8px;
          width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted-on-dark);
        }
        .icon-btn:hover { transform: scale(1.08); color: var(--text-on-dark); background: rgba(255,255,255,0.04); }

        /* Card body */
        .card-body { display:flex; flex-direction:column; gap: 12px; margin-bottom: 12px; }
        .info-row { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:14px; }
        .info-row.countdown-row { background: rgba(255,255,255,0.02); padding:12px; border-radius: 12px; margin-top:8px; }
        .info-label { display:flex; align-items:center; gap:8px; color:var(--muted-on-dark); font-weight:700; }
        .info-value { color:var(--text-on-dark); font-weight:600; text-align:right; }

        .countdown-chip {
          display:inline-flex; align-items:center; padding:8px 14px; border-radius:9999px; font-weight:800; color: #021018;
          background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          box-shadow: 0 10px 30px rgba(6,182,212,0.06);
        }
        .countdown-chip.charging { background: linear-gradient(135deg, var(--color-charging), #059669); color: #021018; }
        .countdown-chip.expired { background: linear-gradient(135deg, var(--color-warning), #d97706); color: #021018; }
        .countdown-text { animation: countdownPulse 2s ease-in-out infinite; color: inherit; }

        /* Actions */
        .card-actions { display:flex; gap:12px; border-top: 1px solid rgba(255,255,255,0.02); padding-top:12px; }
        .btn {
          flex:1; min-height:44px; padding: 12px 16px; border-radius: 9999px; font-weight:700;
          display:flex; gap:10px; align-items:center; justify-content:center; cursor:pointer; border:none; color:var(--text-on-dark);
          transition: transform var(--animation-fast) var(--animation-ease), box-shadow var(--animation-fast);
        }
        .btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; box-shadow:none; }
        .btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 18px 48px rgba(2,6,23,0.6); }

        .btn-navigate { background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end)); color: #021018; }
        .btn-cancel { background: linear-gradient(135deg, var(--color-danger), #dc2626); color: #fff; }

        /* Skeleton */
        .skeleton-card { pointer-events:none; opacity:0.9; }
        .skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%); background-size:200% 100%; animation: shimmer 1.5s ease-in-out infinite; border-radius:8px; min-height:16px; }
        .skeleton-header { height:56px; margin-bottom:14px; }
        .skeleton-line { height:18px; margin-bottom:12px; }
        .skeleton-line.short { width:60%; }

        /* Empty */
        .empty-state { text-align:center; padding: 28px; border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.03); }
        .empty-icon { color: rgba(255,255,255,0.12); margin-bottom: 10px; }
        .empty-title { font-size:18px; font-weight:700; color: var(--text-on-dark); margin-bottom:8px; }
        .empty-description { color: var(--muted-on-dark); }

        /* Toasts */
        .toast-container { position: fixed; top: 20px; right: 20px; display:flex; flex-direction:column; gap:12px; z-index:2000; }
        .toast {
          min-width: 320px; max-width:420px; padding:12px 16px; border-radius:12px; display:flex; gap:12px; align-items:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.04); box-shadow: var(--shadow-md);
        }
        .toast-icon { color: var(--color-primary-end); flex-shrink:0; }
        .toast-success .toast-icon { color: var(--color-charging); }
        .toast-error .toast-icon { color: var(--color-danger); }
        .toast-warning .toast-icon { color: var(--color-warning); }
        .toast-message { color: var(--text-on-dark); font-weight:600; flex:1; }
        .toast-close { background: transparent; border:none; color: var(--muted-on-dark); cursor:pointer; padding:6px; border-radius:8px; }

        /* Modal */
        .modal-overlay { position:fixed; inset:0; background: rgba(2,6,23,0.7); backdrop-filter: blur(6px); display:flex; align-items:center; justify-content:center; z-index:3000; padding:20px; }
        .modal { max-width:460px; width:100%; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02)); border-radius:16px; padding:24px; border:1px solid rgba(255,255,255,0.04); box-shadow: var(--shadow-xl); color: var(--text-on-dark); }
        .modal-title { font-size:20px; font-weight:800; margin-bottom:10px; }
        .modal-message { color: var(--muted-on-dark); line-height:1.6; }
        .modal-actions { display:flex; gap:12px; margin-top:20px; }
        .modal-btn { flex:1; min-height:48px; border-radius:9999px; font-weight:700; cursor:pointer; border:none; }
        .modal-btn-cancel { background: rgba(255,255,255,0.02); color: var(--text-on-dark); }
        .modal-btn-confirm { background: linear-gradient(135deg, var(--color-danger), #dc2626); color: white; }

        /* Responsive */
        @media (min-width: 640px) { .cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .cards-grid { grid-template-columns: repeat(3, 1fr); } .my-reservations-container { padding: 40px; } }

        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

        /* small keyframes reused */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes countdownPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
      `}</style>

      <div className="my-reservations-container" ref={scrollRef}>
        {/* Sticky Summary Bar */}
        <div className={`sticky-bar ${showStickyBar ? "visible" : ""}`}>
          <div className="sticky-bar-content">
            <div className="sticky-bar-badge">{activeReservations.length} Active</div>
            <div className="sticky-bar-badge">{pastReservations.length} Past</div>
          </div>
          {!isOnline && (
            <div className="offline-indicator">
              <WifiOff size={16} />
              Offline
            </div>
          )}
        </div>

        {/* Header */}
        <div className="header">
          <h1 className="header-title">
            <Battery size={clamp(32, 48)} />
            My EV Charging Reservations
            <Zap size={clamp(32, 48)} />
          </h1>

          <div className="header-divider" />
          <p className="header-subtitle">Track your active and past charging sessions</p>
        </div>

        {/* Loading */}
        {isLoading ? (
          <>
            <div className="section">
              <h2 className="section-title"><Zap size={20} /> Active Reservations</h2>
              <div className="cards-grid">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Active */}
            <div className="section">
              <h2 className="section-title">
                <Zap size={20} />
                Active Reservations
                {activeReservations.length > 0 && (
                  <span className="status-badge" style={{ marginLeft: 12, background: "linear-gradient(135deg,var(--color-charging),#16a34a)", color: "#021018" }}>
                    {activeReservations.length}
                  </span>
                )}
              </h2>

              {activeReservations.length === 0 ? (
                <EmptyState type="active" />
              ) : (
                <div className="cards-grid">
                  {activeReservations.map((res) => (
                    <ReservationCard key={res.id} reservation={res} type="active" />
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            <div className="section">
              <h2 className="section-title">
                <Calendar size={20} />
                Past Reservations
                {pastReservations.length > 0 && (
                  <span className="status-badge" style={{ marginLeft: 12, background: "rgba(255,255,255,0.04)", color: "var(--muted-on-dark)" }}>
                    {pastReservations.length}
                  </span>
                )}
              </h2>

              {pastReservations.length === 0 ? (
                <EmptyState type="past" />
              ) : (
                <div className="cards-grid">
                  {pastReservations.map((res) => (
                    <ReservationCard key={res.id} reservation={res} type="past" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!isOnline && !showStickyBar && (
          <div
            className="offline-indicator"
            style={{
              position: "fixed",
              bottom: "32px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1200,
            }}
            aria-live="polite"
          >
            <WifiOff size={16} />
            You're offline
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Toast toast={t} />
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={confirmModal.onCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">{confirmModal.title}</h2>
              <p className="modal-message">{confirmModal.message}</p>
            </div>

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={confirmModal.onCancel}>Cancel</button>
              <button className="modal-btn modal-btn-confirm" onClick={confirmModal.onConfirm} autoFocus>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper for responsive icon size
const clamp = (min, max) => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1024;
  if (width < 640) return min;
  if (width > 1024) return max;
  return Math.round(min + ((max - min) * (width - 640)) / (1024 - 640));
};

export default MyReservations;
