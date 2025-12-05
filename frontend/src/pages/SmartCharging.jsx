import React, { useState, useEffect, useCallback } from "react";
import {
  getRecommendedStations,
  predictAvailability,
  createPaymentOrder,
  verifyPayment,
  createReservation,
  cancelReservation,
} from "../api/api";

import {
  Zap,
  MapPin,
  DollarSign,
  Battery,
  Clock,
  AlertCircle,
  Loader,
  Navigation,
  Car,
  Copy,
  Check,
} from "lucide-react";

const SmartCharging = () => {
  const [preferences, setPreferences] = useState({
    price: 33,
    distance: 33,
    fast_charger: 34,
  });

  const [location, setLocation] = useState({ lat: null, lng: null });
  const [topStations, setTopStations] = useState([]);
  const [loading, setLoading] = useState(false);

  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [reservedStationId, setReservedStationId] = useState(null);
  const [otp, setOtp] = useState(null);
  const [duration, setDuration] = useState(30);

  const [predictions, setPredictions] = useState({});
  const [loadingPredict, setLoadingPredict] = useState(null);

  const [message, setMessage] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [sliderDebounce, setSliderDebounce] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setLocation({ lat: null, lng: null })
      );
    }
  }, []);

  useEffect(() => {
    setTimeout(() => setFadeIn(true), 100);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (sliderDebounce) clearTimeout(sliderDebounce);

    setSliderDebounce(
      setTimeout(() => {
        setPreferences((prev) => ({ ...prev, [name]: Number(value) }));
      }, 300)
    );

    setPreferences((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.lat || !location.lng) {
      setMessage("⚠️ Location not detected. Please enable location services.");
      return;
    }

    setLoading(true);
    setMessage("");
    setTopStations([]);

    try {
      const res = await getRecommendedStations({
        preferences,
        location,
      });

      const stations =
        res?.top_stations ||
        res?.stations ||
        (Array.isArray(res) ? res : []) ||
        [];

      setTopStations(stations);
      if (!stations.length) {
        setMessage("⚠️ No stations matched your preferences. Try adjusting your filters.");
      }
    } catch (err) {
      console.error("getRecommendedStations error:", err);
      setTopStations([]);
      setMessage("❌ Failed to fetch recommended stations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (station) => {
    const stationId = station.id ?? station.station_id;
    if (!stationId) return;

    setLoadingPredict(stationId);
    setPredictions((prev) => ({ ...prev, [stationId]: null }));

    try {
      const res = await predictAvailability({
        station_id: stationId,
        user_lat: location.lat,
        user_lng: location.lng,
      });

      setPredictions((prev) => ({ ...prev, [stationId]: res }));
    } catch (err) {
      console.error("Prediction error:", err);
      setMessage("❌ Failed to check availability. Please try again.");
    } finally {
      setLoadingPredict(null);
    }
  };

  const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject("Failed to load Razorpay SDK");
      document.body.appendChild(script);
    });

  const handleReserve = async (station) => {
    const stationId = station.id ?? station.station_id;
    if (!stationId) return;

    try {
      setLoading(true);
      setMessage("");

      await loadRazorpayScript();

      const orderRes = await createPaymentOrder({
        station_id: stationId,
        duration,
      });

      if (orderRes.error) {
        throw new Error(orderRes.error);
      }

      const { order, razorpay_key } = orderRes;

      const paymentId = await new Promise((resolve, reject) => {
        const options = {
          key: razorpay_key,
          amount: order.amount,
          currency: order.currency,
          order_id: order.id,
          name: "EV ChargeSmart",
          description: `Reservation at ${station.name}`,

          handler: async (response) => {
            try {
              const verify = await verifyPayment({
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature,
              });

              if (verify.error) {
                reject(verify.error);
              } else {
                resolve(response.razorpay_payment_id);
              }
            } catch (err) {
              reject(err.message || "Verification failed");
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (resp) =>
          reject(resp.error?.description || "Payment failed")
        );
        rzp.open();
      });

      const res = await createReservation({
        station_id: stationId,
        latitude: location.lat,
        longitude: location.lng,
        payment_id: paymentId,
        duration,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setOtp(res.otp);
      setActiveReservationId(res.reservation_id);
      setReservedStationId(stationId);
      setHasActiveReservation(true);

      setMessage(
        `✅ Reservation confirmed at ${station.name}!\nETA: ${new Date(
          res.eta_time
        ).toLocaleTimeString()} | Expires: ${new Date(
          res.expires_at
        ).toLocaleTimeString()}`
      );
    } catch (err) {
      console.error(err);
      setMessage(`❌ Reservation or Payment Failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (!activeReservationId) return;

      setLoading(true);
      setMessage("");

      const res = await cancelReservation(activeReservationId);
      if (res?.error) {
        throw new Error(res.error);
      }

      setHasActiveReservation(false);
      setActiveReservationId(null);
      setReservedStationId(null);
      setOtp(null);

      setMessage("✅ Reservation cancelled successfully.");
    } catch (err) {
      console.error(err);
      setMessage(`❌ Cancel failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const openNavigation = (station) => {
    const stationLat = station.latitude;
    const stationLng = station.longitude;

    if (!stationLat || !stationLng) {
      setMessage("❌ Station coordinates not available for navigation.");
      return;
    }

    const origin =
      location.lat && location.lng
        ? `${location.lat},${location.lng}`
        : "My+Location";

    const dest = `${stationLat},${stationLng}`;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(dest)}&travelmode=driving`;

    window.open(url, "_blank");
  };

  const copyOtpToClipboard = () => {
    if (otp) {
      navigator.clipboard.writeText(otp).then(() => {
        setCopiedOtp(true);
        setTimeout(() => setCopiedOtp(false), 2000);
      });
    }
  };

  const renderStation = useCallback(
    (station, index) => {
      const stationId = station.id ?? station.station_id;
      const prediction = predictions[stationId];
      const isTop = index === 0;

      const surgePrice =
        typeof station.dynamic_price === "number"
          ? station.dynamic_price
          : station.price_per_kwh;

      const distance =
        station.distance_km !== undefined && station.distance_km !== null
          ? `${station.distance_km.toFixed(1)} km`
          : "N/A";

      const eta =
        station.eta_mins !== undefined && station.eta_mins !== null
          ? `${station.eta_mins} min`
          : "N/A";

      const hasFast =
        station.has_fast_charger ??
        station.fast_charger ??
        station.fast_charger === 1;

      const surgeLabel = station.label || "Dynamic Price";

      const isThisReserved =
        hasActiveReservation && reservedStationId === stationId;

      return (
        <div
          key={stationId}
          className="station-card"
          style={{
            padding: "var(--spacing-lg)",
            marginBottom: "var(--spacing-lg)",
            borderRadius: "var(--radius-xl)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            border: isTop
              ? "2px solid var(--accent-green)"
              : "1px solid rgba(255,255,255,0.06)",
            boxShadow: isTop
              ? "0 8px 32px rgba(16, 185, 129, 0.2)"
              : "0 4px 16px rgba(0,0,0,0.4)",
            position: "relative",
            transition: "all 0.3s var(--ease-out)",
          }}
        >
          {isTop && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "linear-gradient(135deg, var(--warm-yellow), #f97316)",
                color: "white",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: "0 4px 12px rgba(251, 191, 36, 0.3)",
              }}
            >
              ⭐ Best Match
            </div>
          )}

          <h3
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              marginBottom: 6,
              color: "var(--text-light)",
            }}
          >
            #{index + 1} {station.name}
          </h3>
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
              color: "var(--text-muted-light)",
              fontSize: "0.9rem",
            }}
          >
            <MapPin size={16} />
            {station.location}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "var(--spacing-sm)",
              marginBottom: 16,
            }}
          >
            <div
              className="info-card"
              style={{ background: "rgba(37, 99, 235, 0.06)" }}
            >
              <div className="info-card-header">
                <DollarSign size={14} />
                <span>Base Price</span>
              </div>
              <div className="info-card-value">₹{station.price_per_kwh}/kWh</div>
            </div>

            <div
              className="info-card"
              style={{ background: "rgba(16, 185, 129, 0.06)" }}
            >
              <div className="info-card-header">
                <Zap size={14} />
                <span>{surgeLabel}</span>
              </div>
              <div className="info-card-value">₹{surgePrice}</div>
            </div>

            <div
              className="info-card"
              style={{ background: "rgba(59, 130, 246, 0.06)" }}
            >
              <div className="info-card-header">
                <Navigation size={14} />
                <span>Distance</span>
              </div>
              <div className="info-card-value">{distance}</div>
            </div>

            <div
              className="info-card"
              style={{ background: "rgba(168, 85, 247, 0.06)" }}
            >
              <div className="info-card-header">
                <Clock size={14} />
                <span>ETA</span>
              </div>
              <div className="info-card-value">{eta}</div>
            </div>
          </div>

          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.875rem",
              color: "var(--text-muted-light)",
              marginBottom: 16,
            }}
          >
            <Battery size={16} />
            <span>
              Charger Type:{" "}
              <strong
                style={{
                  color: hasFast ? "var(--accent-green)" : "var(--text-light)",
                }}
              >
                {hasFast ? "⚡ Fast Charger" : "Standard Charger"}
              </strong>
            </span>
          </p>

          <div
            style={{
              display: "flex",
              gap: "var(--spacing-sm)",
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <button
              disabled={loadingPredict === stationId}
              onClick={() => handlePredict(station)}
              className="btn btn-primary"
              style={{
                flex: "1 1 160px",
              }}
              aria-disabled={loadingPredict === stationId}
            >
              {loadingPredict === stationId ? (
                <>
                  <Loader size={16} className="spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Predict Availability
                </>
              )}
            </button>

            <button
              onClick={() => openNavigation(station)}
              className="btn btn-secondary"
              style={{
                flex: "1 1 140px",
              }}
            >
              <Navigation size={16} />
              Navigate
            </button>
          </div>

          {prediction && (
            <div
              className="prediction-panel"
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: "var(--radius-lg)",
                background: prediction.can_reserve
                  ? "rgba(16, 185, 129, 0.08)"
                  : "rgba(239, 68, 68, 0.08)",
                border: prediction.can_reserve
                  ? "1px solid var(--accent-green)"
                  : "1px solid var(--danger)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "var(--text-light)",
                }}
              >
                <Zap size={18} />
                <span>Availability Prediction</span>
              </div>
              <p style={{ marginBottom: 6, fontSize: "0.9rem", color: "var(--text-light)" }}>
                {prediction.message}
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted-light)" }}>
                🔌 Predicted free slots: <strong>{prediction.predicted_free_slots}</strong>
              </p>

              {!hasActiveReservation ? (
                prediction.can_reserve ? (
                  <button
                    onClick={() => handleReserve(station)}
                    disabled={loading}
                    className="btn btn-success"
                    style={{
                      marginTop: 12,
                      width: "100%",
                    }}
                    aria-disabled={loading}
                  >
                    <Car size={18} />
                    {loading ? "Processing Payment..." : "Reserve & Pay"}
                  </button>
                ) : (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "var(--danger)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      padding: 10,
                      background: "rgba(239, 68, 68, 0.1)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <AlertCircle size={18} />
                    <span>Reservation not recommended at this time.</span>
                  </div>
                )
              ) : isThisReserved ? (
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="btn btn-danger"
                  style={{
                    marginTop: 12,
                    width: "100%",
                  }}
                  aria-disabled={loading}
                >
                  {loading ? "Cancelling..." : "Cancel Reservation"}
                </button>
              ) : (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: "0.875rem",
                    color: "var(--text-muted-light)",
                    background: "rgba(107, 114, 128, 0.1)",
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                  }}
                >
                  🔒 You already have an active reservation at another station.
                </div>
              )}
            </div>
          )}
        </div>
      );
    },
    [
      predictions,
      loadingPredict,
      hasActiveReservation,
      reservedStationId,
      loading,
      location,
      duration,
    ]
  );

  const renderEmptyState = () => (
    <div
      style={{
        textAlign: "center",
        padding: "var(--spacing-xl)",
        color: "var(--text-muted-light)",
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        style={{ margin: "0 auto 20px" }}
      >
        <circle cx="60" cy="60" r="50" fill="#08303a" />
        <path
          d="M40 60 L60 40 L60 50 L70 50 L70 35 L80 60 L60 60 L60 75 Z"
          fill="var(--primary-blue)"
        />
        <circle cx="35" cy="85" r="8" fill="#334155" />
        <circle cx="85" cy="85" r="8" fill="#334155" />
        <path
          d="M30 85 L25 85 L25 75 L35 70 L50 70 L50 75 L90 75 L90 85 L85 85"
          stroke="#475569"
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <p style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8, color: "var(--text-light)" }}>
        Ready to Find Your Perfect Charging Station?
      </p>
      <p style={{ fontSize: "0.9rem", color: "var(--text-muted-light)" }}>
        Adjust your preferences above and click{" "}
        <strong>"Find Best Stations"</strong> to get AI-powered recommendations.
      </p>
    </div>
  );

  const renderLoadingSkeleton = () => (
    <div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton-card"
          style={{
            height: 280,
            marginBottom: "var(--spacing-lg)",
            borderRadius: "var(--radius-xl)",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      className="page-dark-bg"
      style={{
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.6s var(--ease-out)",
      }}
    >
      <style>
        {`
          :root {
            --bg-top: #041622;
            --bg-bottom: #0e2a3a;
            --accent-teal: #22c55e;
            --accent-cyan: #06b6d4;
            --primary-blue: #06b6d4;
            --accent-green: #10b981;
            --warm-yellow: #fbbf24;
            --danger: #ef4444;
            --text-light: rgba(255,255,255,0.94);
            --text-muted-light: rgba(255,255,255,0.75);
            --card-dark: rgba(255,255,255,0.04);
            --card-dark-2: rgba(255,255,255,0.06);
            --glass-dark: rgba(255,255,255,0.06);
            --border-glass: rgba(255,255,255,0.08);
            --shadow-dark: 0 8px 32px rgba(2,10,20,0.6);

            --radius-sm: 8px;
            --radius-md: 12px;
            --radius-lg: 16px;
            --radius-xl: 20px;
            --radius-full: 9999px;

            --spacing-sm: 8px;
            --spacing-lg: 20px;
            --spacing-xl: 32px;

            --ease-out: cubic-bezier(0.33,1,0.68,1);
          }

          .page-dark-bg {
            min-height: 100vh;
            padding: clamp(16px, 4vw, 40px);
            background:
              radial-gradient(800px 400px at 10% 6%, rgba(0,120,120,0.03), transparent 10%),
              linear-gradient(135deg, var(--bg-top) 0%, #112233 50%, var(--bg-bottom) 100%);
            color: var(--text-light);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }

          .glass-card {
            padding: var(--spacing-lg);
            border-radius: var(--radius-xl);
            background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-glass);
            box-shadow: var(--shadow-dark);
            color: var(--text-light);
          }

          .hero-heading {
            font-weight: 800;
            margin-bottom: 8px;
            font-size: clamp(1.75rem, 5vw, 2.5rem);
            background: linear-gradient(135deg, var(--accent-teal) 0%, var(--accent-cyan) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hero-sub {
            color: var(--text-muted-light);
            max-width: 60ch;
            margin: 0 auto;
          }

          .top-badge {
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:10px 18px;
            border-radius:999px;
            background: rgba(34,197,94,0.12);
            border: 1px solid rgba(34,197,94,0.25);
            color: var(--accent-teal);
            font-weight: 600;
          }

          .btn {
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:8px;
            padding:12px 20px;
            border-radius: var(--radius-full);
            border: none;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.18s var(--ease-out);
          }

          .btn-primary {
            background: linear-gradient(135deg, var(--accent-teal), var(--accent-cyan));
            color: #001219;
            box-shadow: 0 8px 20px rgba(3, 90, 80, 0.18);
          }

          .btn-secondary {
            background: rgba(255,255,255,0.06);
            color: var(--text-light);
            border: 1px solid rgba(255,255,255,0.06);
          }

          .btn-success {
            background: linear-gradient(135deg, var(--accent-green), #059669);
            color: white;
            box-shadow: 0 6px 18px rgba(16,185,129,0.14);
          }

          .btn-danger {
            background: linear-gradient(135deg, var(--danger), #dc2626);
            color: white;
          }

          input[type="range"] {
            width: 100%;
            height: 8px;
            border-radius: 999px;
            background: rgba(255,255,255,0.06);
            -webkit-appearance: none;
            outline: none;
          }

          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--accent-cyan);
            box-shadow: 0 6px 16px rgba(3, 90, 120, 0.25);
            cursor: pointer;
          }

          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--accent-cyan);
            cursor: pointer;
          }

          input[type="number"] {
            width: 120px;
            padding: 12px;
            border-radius: var(--radius-md);
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.25);
            color: var(--text-light);
            font-weight: 600;
            text-align: center;
          }

          .spin { animation: spin 1s linear infinite; }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }

          .station-card {
            animation: fadeInUp 0.5s var(--ease-out) both;
          }

          .station-card:nth-child(1) { animation-delay: 0.1s; }
          .station-card:nth-child(2) { animation-delay: 0.2s; }
          .station-card:nth-child(3) { animation-delay: 0.3s; }

          .info-card {
            padding: 12px;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
          }

          .info-card-header {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            color: var(--text-light);
            margin-bottom: 6px;
          }

          .info-card-value {
            font-size: 1.125rem;
            font-weight: 700;
            color: var(--text-light);
          }

          .text-muted {
            color: var(--text-muted-light);
          }

          .btn:focus-visible, input[type="range"]:focus-visible, input[type="number"]:focus-visible {
            outline: 3px solid rgba(6,186,212,0.12);
            outline-offset: 2px;
          }
        `}
      </style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: "var(--spacing-xl)" }}>
          <h1
            className="hero-heading"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <span className="top-badge" style={{ padding: "6px 10px", fontSize: 18, gap: 10 }}>
              <Zap size={22} style={{ color: "var(--accent-teal)" }} />
              Smart EV Charging
            </span>
          </h1>
          <p className="hero-sub" style={{ fontSize: "1rem", maxWidth: 600, margin: "0 auto" }}>
            AI-powered station recommendations with live surge pricing, real-time availability prediction, and instant reservations.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="glass-card" style={{ marginBottom: "var(--spacing-xl)" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "var(--spacing-lg)",
              color: "var(--text-light)",
            }}
          >
            🎯 Set Your Preferences
          </h2>

          {[
            { key: "price", label: "Price Priority", icon: DollarSign },
            { key: "distance", label: "Distance Priority", icon: Navigation },
            { key: "fast_charger", label: "Fast Charger Priority", icon: Zap },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} style={{ marginBottom: "var(--spacing-lg)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <label
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "var(--text-light)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  htmlFor={`slider-${key}`}
                >
                  <Icon size={16} />
                  {label}
                </label>
                <span
                  style={{
                    fontSize: "0.875rem",
                    padding: "4px 12px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(34,197,94,0.08)",
                    color: "var(--accent-teal)",
                    fontWeight: 700,
                  }}
                >
                  {preferences[key]}%
                </span>
              </div>

              <input
                id={`slider-${key}`}
                type="range"
                name={key}
                min="0"
                max="100"
                step="5"
                value={preferences[key]}
                onChange={handleChange}
                style={{
                  background: `linear-gradient(to right, var(--primary-blue) 0%, var(--primary-blue) ${preferences[key]}%, rgba(255,255,255,0.06) ${preferences[key]}%, rgba(255,255,255,0.06) 100%)`,
                }}
                aria-label={label}
              />
            </div>
          ))}

          <div style={{ marginTop: "var(--spacing-lg)" }}>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
                color: "var(--text-light)",
              }}
              htmlFor="duration-input"
            >
              <Clock size={16} />
              Charging Duration
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                id="duration-input"
                type="number"
                min="15"
                step="15"
                max="240"
                value={duration}
                onChange={(e) => setDuration(Math.max(15, Number(e.target.value)))}
                style={{
                  width: 120,
                  padding: 12,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  textAlign: "center",
                  background: "rgba(0,0,0,0.25)",
                  color: "var(--text-light)",
                }}
                aria-label="Duration in minutes"
              />
              <span style={{ fontSize: "0.9rem", color: "var(--text-muted-light)" }}>
                minutes (minimum 15 min)
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !location.lat}
            className="btn btn-primary"
            style={{
              marginTop: "var(--spacing-lg)",
              width: "100%",
              padding: "14px 24px",
              fontSize: "1rem",
            }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" />
                Finding Best Stations...
              </>
            ) : !location.lat ? (
              <>
                <AlertCircle size={18} />
                Waiting for Location...
              </>
            ) : (
              <>
                <Zap size={18} />
                Find Best Stations
              </>
            )}
          </button>
        </form>

        {message && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "var(--spacing-lg)",
              borderRadius: "var(--radius-lg)",
              background: message.includes("❌")
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(16, 185, 129, 0.08)",
              border: message.includes("❌")
                ? "1px solid var(--danger)"
                : "1px solid var(--accent-green)",
              marginBottom: "var(--spacing-lg)",
              fontWeight: 500,
              whiteSpace: "pre-line",
              fontSize: "0.9rem",
              color: "var(--text-light)",
            }}
          >
            {message}
          </div>
        )}

        {otp && (
          <div
            style={{
              padding: "var(--spacing-lg)",
              marginBottom: "var(--spacing-lg)",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(90deg, rgba(251,191,36,0.08), rgba(251,191,36,0.05))",
              border: "2px solid rgba(251,191,36,0.22)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
              color: "var(--text-light)",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text-light)",
              }}
            >
              🔑 Your Reservation OTP
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "2rem",
                  fontWeight: 800,
                  letterSpacing: 6,
                  color: "var(--text-light)",
                  background: "rgba(255,255,255,0.03)",
                  padding: "12px 24px",
                  borderRadius: "var(--radius-md)",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                {otp}
              </div>
              <button
                onClick={copyOtpToClipboard}
                className="btn btn-ghost"
                style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", color: "var(--text-light)", border: "1px solid rgba(255,255,255,0.04)" }}
                title="Copy OTP to clipboard"
              >
                {copiedOtp ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "rgba(0,0,0,0.8)" }}>
              Share this code with the station attendant to start charging.
            </p>
          </div>
        )}

        {loading && topStations.length === 0 && renderLoadingSkeleton()}

        {topStations.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "var(--spacing-lg)",
                color: "var(--text-light)",
              }}
            >
              🏆 Recommended Stations
            </h2>

            {topStations.map((station, idx) => renderStation(station, idx))}
          </div>
        )}

        {!loading && topStations.length === 0 && !message && renderEmptyState()}
      </div>
    </div>
  );
};

export default SmartCharging;
