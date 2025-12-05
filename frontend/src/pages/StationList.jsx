import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  getStations,
  getMyReservations,
  predictAvailability,
  getStationReviews,
} from "../api/api";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  MapPin,
  DollarSign,
  Battery,
  AlertCircle,
  Car,
  Loader,
  Phone,
  Shield,
  Star,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Grid3x3,
  List,
  Wifi,
  WifiOff,
  Filter,
  SortAsc,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Navigation,
} from "lucide-react";

const socket = io("http://localhost:5000");

const StationList = () => {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [stations, setStations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [predictions, setPredictions] = useState({});
  const [loadingPredict, setLoadingPredict] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});
  const [stationReviews, setStationReviews] = useState({});
  const [socketConnected, setSocketConnected] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("distance");
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [expandedEmergency, setExpandedEmergency] = useState({});

  const navigate = useNavigate();
  const predictDebounceTimers = useRef({});

  // ========================================
  // TOAST SYSTEM
  // ========================================
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ========================================
  // INITIAL DATA FETCH
  // ========================================
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        const resStations = await getStations();
        const stationsArray = Array.isArray(resStations) ? resStations : [];
        setStations(stationsArray);

        const resReservations = await getMyReservations();
        setReservations(
          Array.isArray(resReservations)
            ? resReservations
            : Array.isArray(resReservations?.data)
            ? resReservations.data
            : []
        );

        for (let s of stationsArray) {
          const reviews = await getStationReviews(s.id);
          setStationReviews((prev) => ({ ...prev, [s.id]: reviews || [] }));
        }

        setIsLoading(false);
        addToast(`Loaded ${stationsArray.length} stations`, "success");
      } catch (err) {
        console.error("Error fetching data:", err);
        setStations([]);
        setReservations([]);
        setIsLoading(false);
        addToast("Failed to load stations", "error");
      }
    }

    fetchData();
  }, [addToast]);

  // ========================================
  // SOCKET LISTENERS
  // ========================================
  useEffect(() => {
    socket.on("connect", () => {
      console.log("🔌 Socket connected!");
      setSocketConnected(true);
      addToast("Connected to live updates", "success");
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected!");
      setSocketConnected(false);
      addToast("Disconnected from live updates", "error");
    });

    socket.on("charging_started", (data) => {
      console.log("⚡ charging_started", data);
      setPredictions((prev) => ({ ...prev, [data.station_id]: null }));
      refreshReservations();
      refreshStations();
      addToast("Charging session started", "info");
    });

    socket.on("charging_stopped", (data) => {
      console.log("🛑 charging_stopped", data);
      refreshReservations();
      refreshStations();
      addToast("Charging session ended", "info");
    });

    socket.on("slot_update", (data) => {
      console.log("📡 Slot Update:", data);
      setStations((prev) =>
        prev.map((station) =>
          station.id === data.station_id
            ? { ...station, reserved_slots: data.reserved_slots }
            : station
        )
      );
    });

    socket.on("reservation_expired", () => {
      console.log("⌛ Reservation expired");
      refreshReservations();
      refreshStations();
      addToast("A reservation has expired", "info");
    });

    socket.on("otp_verified", (data) => {
      console.log("🔐 OTP Verified:", data);
      addToast("OTP verified successfully", "success");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("charging_started");
      socket.off("charging_stopped");
      socket.off("slot_update");
      socket.off("reservation_expired");
      socket.off("otp_verified");
    };
  }, [addToast]);

  // ========================================
  // REFRESH FUNCTIONS
  // ========================================
  const refreshReservations = async () => {
    const res = await getMyReservations();
    setReservations(Array.isArray(res) ? res : []);
  };

  const refreshStations = async () => {
    const res = await getStations();
    setStations(Array.isArray(res) ? res : []);
  };

  // ========================================
  // UTILITIES
  // ========================================
  const getAvailableSlots = useCallback(
    (stationId, totalSlots) => {
      const reservedCount = reservations.filter(
        (r) => r.station_id === stationId && r.status === "active"
      ).length;
      return Math.max(totalSlots - reservedCount, 0);
    },
    [reservations]
  );

  const getAvailabilityStatus = (availableSlots, totalSlots) => {
    const ratio = totalSlots ? availableSlots / totalSlots : 0;
    if (ratio > 0.5) return { label: "Available", color: "var(--accent-teal)" };
    if (ratio > 0.2) return { label: "Limited", color: "var(--warning)" };
    if (ratio > 0) return { label: "High Demand", color: "var(--danger)" };
    return { label: "Full", color: "var(--danger)" };
  };

  // ========================================
  // PREDICTION HANDLER WITH DEBOUNCE
  // ========================================
  const handlePredict = useCallback(
    async (station) => {
      if (predictDebounceTimers.current[station.id]) {
        clearTimeout(predictDebounceTimers.current[station.id]);
      }

      predictDebounceTimers.current[station.id] = setTimeout(async () => {
        setLoadingPredict(station.id);
        setPredictions((prev) => ({ ...prev, [station.id]: null }));

        try {
          const res = await predictAvailability({
            station_id: station.id,
            user_lat: 12.9716,
            user_lng: 77.5946,
          });

          if (res.error) {
            addToast(res.error, "error");
          } else {
            setPredictions((prev) => ({ ...prev, [station.id]: res }));
            addToast("Prediction updated", "success");
          }
        } catch (err) {
          console.error(err);
          addToast("Prediction failed", "error");
        } finally {
          setLoadingPredict(null);
        }
      }, 300);
    },
    [addToast]
  );

  const toggleReviews = useCallback((id) => {
    setExpandedReviews((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleEmergency = useCallback((id) => {
    setExpandedEmergency((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ========================================
  // SORTING & FILTERING
  // ========================================
  const sortedAndFilteredStations = useMemo(() => {
    let result = [...stations];

    if (filterAvailable) {
      result = result.filter(
        (s) => getAvailableSlots(s.id, s.total_slots) > 0
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return (a.distance || 0) - (b.distance || 0);
        case "price":
          return a.price_per_kwh - b.price_per_kwh;
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "availability":
          return (
            getAvailableSlots(b.id, b.total_slots) -
            getAvailableSlots(a.id, a.total_slots)
          );
        default:
          return 0;
      }
    });

    return result;
  }, [stations, sortBy, filterAvailable, getAvailableSlots]);

  // ========================================
  // STATION CARD RENDER
  // ========================================
  const renderStationCard = (station) => {
    const reviews = stationReviews[station.id] || [];
    const availableSlots = getAvailableSlots(station.id, station.total_slots);
    const prediction = predictions[station.id];
    const isLoadingThis = loadingPredict === station.id;
    const availStatus = getAvailabilityStatus(
      availableSlots,
      station.total_slots
    );

    return (
      <article
        key={station.id}
        className="station-card"
        role="article"
        aria-label={`${station.name} charging station`}
      >
        {/* Card Header */}
        <div className="card-header">
          <div className="station-avatar">
            <Zap size={28} strokeWidth={2.5} />
          </div>

          <div className="station-header-info">
            <h3 className="station-name">
              <MapPin size={18} />
              {station.name}
            </h3>

            <div className="station-meta">
              <span className="meta-item">
                {station.fast_charger ? "⚡ Fast" : "🔌 Standard"}
              </span>
              <span className="meta-item">
                <DollarSign size={14} />
                ₹{station.price_per_kwh}/kWh
              </span>
            </div>
          </div>

          <div className="rating-badge" aria-label={`Rating ${station.rating || 0} out of 5`}>
            <Star size={16} fill="currentColor" />
            <span className="rating-value">
              {station.rating ? station.rating.toFixed(1) : "0.0"}
            </span>
            <span className="rating-count">({reviews.length})</span>
          </div>
        </div>

        {/* Availability Status Chip */}
        <div
          className="availability-chip"
          style={{ ["--status-color"]: availStatus.color }}
          role="status"
          aria-live="polite"
        >
          <span className="pulse-dot" aria-hidden />
          <span className="status-label">{availStatus.label}</span>
          <span className="slot-count">
            <Battery size={16} />
            {availableSlots}/{station.total_slots}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="slots-progress" role="progressbar" aria-valuenow={availableSlots} aria-valuemin="0" aria-valuemax={station.total_slots}>
          <div
            className="progress-fill"
            style={{
              width: `${(availableSlots / station.total_slots) * 100}%`,
              backgroundColor: availStatus.color,
            }}
          ></div>
        </div>

        {/* CTA Buttons */}
        <div className="cta-group">
          <button
            className="btn btn-primary"
            onClick={() => handlePredict(station)}
            disabled={isLoadingThis}
            aria-busy={isLoadingThis}
          >
            {isLoadingThis ? (
              <>
                <Loader size={18} className="spinner" />
                Checking...
              </>
            ) : (
              <>
                <Zap size={18} />
                Check Availability
              </>
            )}
          </button>

          <button
            className="btn btn-icon"
            onClick={() => navigate(`/stations/${station.id}/navigate`)}
            aria-label="Navigate to station"
            title="Navigate"
          >
            <Navigation size={20} />
          </button>
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div className="prediction-panel" role="region" aria-label="Prediction results">
            <div className="prediction-header">
              <CheckCircle size={18} />
              <strong>{prediction.message}</strong>
            </div>

            <div className="prediction-body">
              <div className="prediction-metric">
                <Battery size={18} />
                <span>
                  Predicted Slots: <strong>{prediction.predicted_free_slots}</strong>
                </span>
              </div>

              {prediction.estimated_wait_time && (
                <div className="prediction-metric">
                  <Clock size={18} />
                  <span>
                    Est. Wait: <strong>{prediction.estimated_wait_time} min</strong>
                  </span>
                </div>
              )}
            </div>

            {prediction.can_reserve ? (
              <button
                className="btn btn-success"
                onClick={() => navigate(`/reserve/${station.id}`)}
              >
                <Car size={18} />
                Reserve Now
              </button>
            ) : (
              <div className="alert-warning">
                <AlertCircle size={18} />
                Not Available for Reservation
              </div>
            )}
          </div>
        )}

        {/* Emergency Support Panel */}
        <div className="collapsible-panel emergency-panel">
          <button
            className="panel-toggle"
            onClick={() => toggleEmergency(station.id)}
            aria-expanded={expandedEmergency[station.id]}
            aria-controls={`emergency-${station.id}`}
          >
            <div className="panel-toggle-label">
              <Shield size={18} />
              <span>Emergency Support</span>
            </div>
            {expandedEmergency[station.id] ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {expandedEmergency[station.id] && (
            <div className="panel-content" id={`emergency-${station.id}`}>
              <div className="contact-info">
                <div className="contact-item">
                  <User size={16} />
                  <span>Owner: <strong>{station.owner_name || "N/A"}</strong></span>
                </div>
                <div className="contact-item">
                  <Mail size={16} />
                  <span><strong>{station.owner_email || "N/A"}</strong></span>
                </div>
                <div className="contact-item">
                  <Phone size={16} />
                  <span><strong>{station.owner_phone || "N/A"}</strong></span>
                </div>
              </div>

              <button
                className="btn btn-danger btn-emergency"
                onClick={() => (window.location.href = `tel:${station.owner_phone}`)}
              >
                <Phone size={18} />
                🚨 Call Emergency
              </button>
            </div>
          )}
        </div>

        {/* Reviews Panel */}
        <div className="collapsible-panel reviews-panel">
          <button
            className="panel-toggle"
            onClick={() => toggleReviews(station.id)}
            aria-expanded={expandedReviews[station.id]}
            aria-controls={`reviews-${station.id}`}
          >
            <div className="panel-toggle-label">
              <MessageCircle size={18} />
              <span>Reviews ({reviews.length})</span>
            </div>
            {expandedReviews[station.id] ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {expandedReviews[station.id] && (
            <div className="panel-content" id={`reviews-${station.id}`}>
              {reviews.length === 0 ? (
                <p className="empty-state">No reviews yet</p>
              ) : (
                <div className="reviews-list">
                  {reviews.slice(0, 3).map((rev) => (
                    <div key={rev.id} className="review-item">
                      <div className="review-stars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < rev.rating ? "currentColor" : "none"}
                            className={i < rev.rating ? "star-filled" : ""}
                          />
                        ))}
                      </div>
                      <p className="review-text">{rev.review_text}</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/stations/${station.id}/review`)}
              >
                Write a Review
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <>
      <style>{`
        :root {
          --bg-top: #041622;
          --bg-bottom: #0e2a3a;
          --accent-teal: #22c55e;
          --accent-cyan: #06b6d4;
          --primary-start: var(--accent-teal);
          --primary-end: var(--accent-cyan);
          --accent-green: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --text-light: rgba(255,255,255,0.95);
          --text-muted-light: rgba(255,255,255,0.72);
          --glass-1: rgba(255,255,255,0.04);
          --glass-2: rgba(255,255,255,0.06);
          --glass-3: rgba(255,255,255,0.02);
          --card-border: rgba(255,255,255,0.06);
          --toast-bg: rgba(2,8,23,0.7);
          --shadow-dark: 0 8px 32px rgba(2,10,20,0.6);
          --radius-sm: 8px;
          --radius-md: 14px;
          --radius-lg: 18px;
          --spacing-sm: 8px;
          --spacing-md: 16px;
          --spacing-lg: 24px;
          --spacing-xl: 32px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .station-list-container {
          min-height: 100vh;
          background:
            radial-gradient(800px 400px at 10% 6%, rgba(6, 182, 212, 0.03), transparent 10%),
            linear-gradient(135deg, var(--bg-top) 0%, #112233 50%, var(--bg-bottom) 100%);
          padding: var(--spacing-lg);
          font-family: system-ui, -apple-system, sans-serif;
          color: var(--text-light);
        }

        .page-header { max-width: 1400px; margin: 0 auto var(--spacing-xl); }

        .header-top {
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom: var(--spacing-lg);
          gap: var(--spacing-md);
          flex-wrap:wrap;
        }

        .page-title {
          font-size: clamp(24px, 5vw, 36px);
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display:flex;
          align-items:center;
          gap: var(--spacing-sm);
        }

        .view-toggle {
          display:flex;
          gap: var(--spacing-xs);
          background: rgba(255,255,255,0.04);
          padding: var(--spacing-xs);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-dark);
        }

        .view-toggle button {
          padding: var(--spacing-sm) var(--spacing-md);
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: var(--radius-sm);
          color: var(--text-muted-light);
          display:flex;
          align-items:center;
          gap:6px;
          font-weight:600;
        }

        .view-toggle button.active {
          background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
          color: #001219;
          box-shadow: var(--shadow-dark);
        }

        /* Status Banner */
        .status-banner {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-dark);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
          border: 1px solid var(--card-border);
        }

        .status-item { display:flex; align-items:center; gap: var(--spacing-sm); color: var(--text-muted-light); font-weight:600; }
        .status-item.connected { color: var(--accent-green); }
        .status-item.disconnected { color: var(--danger); }
        .status-value { font-weight:700; color: var(--text-light); }

        /* Controls bar */
        .controls-bar {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-dark);
          display:flex;
          gap: var(--spacing-md);
          flex-wrap:wrap;
          align-items:center;
          border: 1px solid var(--card-border);
        }

        .control-group { display:flex; align-items:center; gap: var(--spacing-sm); }
        .control-label { font-size:14px; font-weight:600; color: var(--text-muted-light); display:flex; align-items:center; gap:6px; }

        select, .filter-checkbox {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-sm);
          background: rgba(0,0,0,0.25);
          color: var(--text-light);
          font-size: 14px;
          cursor: pointer;
        }

        select:focus, .filter-checkbox:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(6,186,212,0.08);
        }

        .filter-checkbox { width: 20px; height: 20px; cursor: pointer; accent-color: var(--accent-cyan); }

        /* Grid */
        .stations-container { max-width: 1400px; margin: 0 auto; }
        .stations-grid { display:grid; gap: var(--spacing-lg); grid-template-columns: 1fr; }
        .stations-grid.view-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }

        /* Station Card (dark glass) */
        .station-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-dark);
          position: relative;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
          border: 1px solid var(--card-border);
          color: var(--text-light);
        }

        .station-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--primary-start), var(--primary-end));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .station-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(2,10,20,0.7); }
        .station-card:hover::before { opacity: 1; }
        .station-card:focus-within { outline: 3px solid rgba(6,186,212,0.08); outline-offset: 2px; }

        .card-header { display:flex; gap: var(--spacing-md); margin-bottom: var(--spacing-md); align-items:flex-start; }
        .station-avatar {
          width:56px; height:56px; min-width:56px; border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
          display:flex; align-items:center; justify-content:center; color:#001219; box-shadow: 0 6px 20px rgba(2,10,20,0.4);
        }
        .station-header-info { flex:1; min-width:0; }
        .station-name { font-size:18px; font-weight:700; color: var(--text-light); margin-bottom: 6px; display:flex; align-items:center; gap:6px; }
        .station-meta { display:flex; gap: var(--spacing-md); font-size:13px; color: var(--text-muted-light); flex-wrap:wrap; }
        .meta-item { display:flex; align-items:center; gap:4px; }

        .rating-badge {
          display:flex; align-items:center; gap:6px; padding:6px 12px; background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(249,115,22,0.08)); color: #f97316; border-radius: var(--radius-md); font-weight:700;
        }
        .rating-value { font-size:16px; color: #f97316; }
        .rating-count { font-size:12px; opacity:0.85; color: var(--text-muted-light); }

        /* Availability chip */
        .availability-chip {
          display:flex; align-items:center; gap: var(--spacing-sm); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md);
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid var(--card-border);
          margin-bottom: var(--spacing-sm);
          font-weight:600;
        }
        .pulse-dot { width:10px; height:10px; border-radius:50%; background: var(--accent-teal); animation: pulse 2s ease-in-out infinite; }
        .status-label { color: var(--text-light); font-weight:700; flex:1; }
        .slot-count { display:flex; align-items:center; gap:4px; color: var(--text-muted-light); }

        /* Progress */
        .slots-progress { height:8px; background: rgba(255,255,255,0.02); border-radius:999px; overflow:hidden; margin-bottom: var(--spacing-md); }
        .progress-fill { height:100%; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); border-radius:999px; position:relative; overflow:hidden; }
        .progress-fill::after { content:''; position:absolute; top:0; left:0; right:0; bottom:0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: shimmer 2s infinite; }

        /* CTA Buttons */
        .cta-group { display:flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); }
        .btn {
          padding: 12px 20px; border: none; border-radius: var(--radius-md); font-weight:600; font-size:15px; cursor:pointer;
          display:inline-flex; align-items:center; justify-content:center; gap: var(--spacing-sm); transition: all 0.2s ease; position:relative; overflow:hidden; min-height:44px; flex:1;
          color: var(--text-light);
        }
        .btn::before { content:''; position:absolute; top:50%; left:50%; width:0; height:0; border-radius:50%; background: rgba(255,255,255,0.03); transform: translate(-50%, -50%); transition: width 0.6s, height 0.6s; }
        .btn:active::before { width:300px; height:300px; }
        .btn:disabled { opacity:0.6; cursor:not-allowed; }

        .btn-primary { background: linear-gradient(135deg, var(--primary-start), var(--primary-end)); color: #001219; box-shadow: 0 8px 20px rgba(2,10,20,0.6); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(2,10,20,0.7); }

        .btn-success { background: linear-gradient(135deg, var(--accent-green), #059669); color: white; box-shadow: 0 6px 18px rgba(16,185,129,0.14); width:100%; }
        .btn-secondary { background: rgba(255,255,255,0.03); color: var(--text-light); border: 1px solid var(--card-border); width: 100%; }
        .btn-icon { padding:12px; flex:0; min-width:44px; background: rgba(255,255,255,0.03); color: var(--text-light); border-radius: var(--radius-md); }

        .btn-emergency { animation: pulse-urgent 2s ease-in-out infinite; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }

        /* Prediction panel (light-green but adapted) */
        .prediction-panel {
          background: linear-gradient(135deg, rgba(16,185,129,0.06), rgba(220,255,240,0.03));
          border: 1px solid rgba(16,185,129,0.16);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
          color: var(--text-light);
          animation: slideDown 0.3s ease;
        }
        .prediction-header { display:flex; gap: var(--spacing-sm); align-items:center; color: var(--accent-green); margin-bottom: var(--spacing-sm); }
        .prediction-body { display:flex; flex-direction:column; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); color: var(--text-light); }
        .prediction-metric { display:flex; align-items:center; gap: var(--spacing-sm); color: var(--text-muted-light); }

        .alert-warning { display:flex; align-items:center; gap: var(--spacing-sm); padding: var(--spacing-sm); background: rgba(255,235,238,0.03); border: 1px solid rgba(245,158,11,0.12); border-radius: var(--radius-sm); color: var(--danger); font-weight:600; }

        /* Collapsible */
        .collapsible-panel { margin-bottom: var(--spacing-md); border-radius: var(--radius-md); overflow:hidden; border: 1px solid var(--card-border); }
        .emergency-panel { border-color: rgba(239,68,68,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005)); }
        .reviews-panel { border-color: var(--card-border); background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005)); }
        .panel-toggle { width:100%; padding: var(--spacing-md); background: transparent; border:none; display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-weight:600; font-size:15px; min-height:44px; color: var(--text-light); }
        .panel-toggle:hover { background: rgba(255,255,255,0.02); }
        .panel-content { padding: var(--spacing-md); animation: slideDown 0.3s ease; background: rgba(0,0,0,0.25); border-top: 1px solid var(--card-border); color: var(--text-muted-light); }

        .contact-info { display:flex; flex-direction:column; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); }
        .contact-item { display:flex; align-items:center; gap: var(--spacing-sm); font-size:14px; color: var(--text-muted-light); }

        .reviews-list { display:flex; flex-direction:column; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); }
        .review-item { background: rgba(255,255,255,0.02); padding: var(--spacing-md); border-radius: var(--radius-sm); border: 1px solid var(--card-border); color: var(--text-muted-light); }
        .review-stars { display:flex; gap: 2px; margin-bottom: var(--spacing-xs); color: var(--warm-yellow, #fbbf24); }
        .star-filled { color: #f59e0b; }
        .review-text { font-size:14px; color: var(--text-muted-light); line-height:1.5; }
        .empty-state { text-align:center; color: var(--text-muted-light); padding: var(--spacing-lg); font-style:italic; }

        /* Loading */
        .loading-container { text-align:center; padding: var(--spacing-xl); color: var(--text-light); }
        .spinner { animation: spin 1s linear infinite; }

        /* Toasts */
        .toast-container { position: fixed; top: var(--spacing-lg); right: var(--spacing-lg); z-index: 1000; display:flex; flex-direction:column; gap: var(--spacing-sm); max-width: 420px; }
        .toast { background: var(--toast-bg); padding: var(--spacing-md); border-radius: var(--radius-md); box-shadow: 0 10px 30px rgba(2,10,20,0.6); display:flex; align-items:center; gap: var(--spacing-sm); animation: toastSlideIn 0.3s ease; border-left: 4px solid; color: var(--text-light); }
        .toast.success { border-color: var(--accent-green); }
        .toast.info { border-color: var(--primary-start); }
        .toast.error { border-color: var(--danger); }
        .toast-message { flex:1; font-size:14px; font-weight:500; color: var(--text-light); }
        .toast-close { background:none; border:none; cursor:pointer; padding:4px; display:flex; color: var(--text-muted-light); }

        @keyframes pulse { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:0.5; transform:scale(1.2);} }
        @keyframes pulse-urgent { 0%,100%{ box-shadow: 0 0 0 0 rgba(239,68,68,0.7);} 50%{box-shadow: 0 0 0 10px rgba(239,68,68,0);} }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes shimmer { 0%{transform:translateX(-100%);} 100%{transform:translateX(100%);} }
        @keyframes slideDown { from{opacity:0; transform:translateY(-10px);} to{opacity:1; transform:translateY(0);} }
        @keyframes toastSlideIn { from{opacity:0; transform:translateX(100%);} to{opacity:1; transform:translateX(0);} }

        /* Responsive */
        @media (min-width: 640px) { .station-list-container { padding: var(--spacing-xl); } }
        @media (min-width: 768px) {
          .page-title { font-size:36px; }
          .stations-grid.view-grid { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); }
        }
        @media (min-width: 1024px) {
          .stations-grid.view-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width:640px) {
          .controls-bar { flex-direction: column; align-items:stretch; }
          select { width:100%; }
          .toast-container { left: var(--spacing-md); right: var(--spacing-md); max-width:none; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
          .pulse-dot, .btn-emergency, .progress-fill::after { animation: none; }
        }

        *:focus-visible { outline: 3px solid rgba(6,186,212,0.08); outline-offset:2px; border-radius: var(--radius-sm); }

        @media print {
          .view-toggle, .controls-bar, .toast-container, .btn { display:none; }
          .station-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="station-list-container">
        {/* Toast Container */}
        <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.type === "success" && <CheckCircle size={20} />}
              {toast.type === "info" && <AlertCircle size={20} />}
              {toast.type === "error" && <AlertTriangle size={20} />}
              <span className="toast-message">{toast.message}</span>
              <button
                className="toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        {/* Page Header */}
        <header className="page-header">
          <div className="header-top">
            <h1 className="page-title">
              <Zap size={36} />
              Charging Stations
            </h1>

            <div className="view-toggle" role="tablist" aria-label="View mode">
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                role="tab"
                aria-selected={viewMode === "list"}
                aria-label="List view"
              >
                <List size={18} />
                List
              </button>
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                role="tab"
                aria-selected={viewMode === "grid"}
                aria-label="Grid view"
              >
                <Grid3x3 size={18} />
                Grid
              </button>
            </div>
          </div>

          {/* Status Banner */}
          <div className="status-banner" role="status" aria-live="polite">
            <div className={`status-item ${socketConnected ? "connected" : "disconnected"}`}>
              {socketConnected ? (
                <>
                  <Wifi size={20} />
                  <span>Live Updates Active</span>
                </>
              ) : (
                <>
                  <WifiOff size={20} />
                  <span>Offline Mode</span>
                </>
              )}
            </div>

            <div className="status-item">
              <Battery size={20} />
              <span>
                <span className="status-value">{sortedAndFilteredStations.length}</span> Stations
              </span>
            </div>

            <div className="status-item">
              <Car size={20} />
              <span>
                <span className="status-value">{reservations.length}</span> Active Reservations
              </span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            <div className="control-group">
              <label htmlFor="sort-select" className="control-label">
                <SortAsc size={16} />
                Sort By
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort stations by"
              >
                <option value="distance">Distance</option>
                <option value="price">Price</option>
                <option value="rating">Rating</option>
                <option value="availability">Availability</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="filter-available" className="control-label">
                <Filter size={16} />
                Show Available Only
              </label>
              <input
                id="filter-available"
                type="checkbox"
                className="filter-checkbox"
                checked={filterAvailable}
                onChange={(e) => setFilterAvailable(e.target.checked)}
                aria-label="Filter by availability"
              />
            </div>
          </div>
        </header>

        {/* Stations Grid/List */}
        <main className="stations-container">
          {isLoading ? (
            <div className="loading-container" role="status" aria-live="polite">
              <Loader size={48} className="spinner" />
              <h3>Loading charging stations...</h3>
            </div>
          ) : sortedAndFilteredStations.length === 0 ? (
            <div className="loading-container">
              <Zap size={64} />
              <h3 style={{ color: "var(--text-light)" }}>
                {filterAvailable
                  ? "No available stations found"
                  : "No stations available"}
              </h3>
            </div>
          ) : (
            <div className={`stations-grid view-${viewMode}`}>
              {sortedAndFilteredStations.map((station) =>
                renderStationCard(station)
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default StationList;
