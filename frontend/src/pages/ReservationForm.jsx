import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  createReservation,
  cancelReservation,
  createPaymentOrder,
  verifyPayment,
  getMyReservations,
} from "../api/api";
import { getAuthToken } from "../utils/jwt";
import {
  Clock,
  Zap,
  Car,
  Battery,
  X,
  MapPin,
  Key,
  Loader,
  Navigation,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

/**
 * ReservationForm — updated visual theme to match teal → indigo + emerald accents,
 * navy/dark background and glass cards (same color language used across your app)
 *
 * Logic unchanged. Replace existing file with this complete code.
 */

const ReservationForm = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [navUrl, setNavUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [duration, setDuration] = useState(30);
  const [otp, setOtp] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);

  // Fade in animation on mount
  useEffect(() => {
    setTimeout(() => setFadeIn(true), 90);
  }, []);

  // Check if user already has an active reservation
  useEffect(() => {
    const checkActiveReservation = async () => {
      if (!getAuthToken()) {
        setMessage("❌ You must be logged in to make a reservation.");
        return;
      }
      try {
        const res = await getMyReservations();
        if (res && Array.isArray(res)) {
          const active = res.find((r) => r.status === "active" || r.charging_status === "running");
          if (active) {
            setHasActiveReservation(true);
            setActiveReservationId(active.reservation_id || active.id);
            setOtp(active.otp || null);
            setNavUrl("");
            setMessage("⚠️ You already have an active reservation.");
          }
        }
      } catch (err) {
        console.error("Failed to check active reservations:", err);
      }
    };

    checkActiveReservation();
  }, []);

  const getUserLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject("Geolocation not supported.");
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject("Could not fetch location. Please enable GPS.")
      );
    });

  const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject("Failed to load Razorpay SDK");
      document.body.appendChild(script);
    });

  const handlePayment = async () => {
    await loadRazorpayScript();

    if (!getAuthToken()) throw new Error("Authentication failed");

    const orderRes = await createPaymentOrder({
      station_id: stationId,
      duration: duration,
    });
    if (orderRes.error) throw new Error(orderRes.error);

    const { order, razorpay_key } = orderRes;

    return new Promise((resolve, reject) => {
      const options = {
        key: razorpay_key,
        amount: order.amount,
        currency: order.currency,
        name: "EV ChargeSmart",
        description: "Reservation Payment",
        order_id: order.id,
        theme: { color: "#06b6d4" }, // teal primary color
        handler: async function (response) {
          try {
            const verifyRes = await verifyPayment({
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
            if (verifyRes.error) return reject(verifyRes.error);
            resolve(response.razorpay_payment_id);
          } catch (err) {
            reject(err.message || err);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => reject(response.error?.description || "Payment failed"));
      rzp.open();
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!getAuthToken()) {
      setMessage("❌ You must be logged in to reserve.");
      return;
    }
    if (hasActiveReservation) {
      setMessage("⚠️ You already have an active reservation.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const location = await getUserLocation();
      const paymentId = await handlePayment();

      const res = await createReservation({
        station_id: stationId,
        latitude: location.lat,
        longitude: location.lng,
        payment_id: paymentId,
        duration: duration,
      });

      if (res.error) {
        setMessage(`❌ ${res.error}`);
      } else {
        setOtp(res.otp);
        setMessage(
          `✅ Reservation successful!\nETA: ${new Date(res.eta_time).toLocaleTimeString()} | Expires at: ${new Date(
            res.expires_at
          ).toLocaleTimeString()}\nYour OTP: ${res.otp}`
        );
        if (res.navigation_url) setNavUrl(res.navigation_url);
        setHasActiveReservation(true);
        setActiveReservationId(res.reservation_id || res.id);
      }
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeReservationId) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await cancelReservation(activeReservationId);
      if (res.error) {
        setMessage(`❌ Cancel failed: ${res.error}`);
      } else {
        setMessage("✅ Reservation canceled successfully.");
        setHasActiveReservation(false);
        setActiveReservationId(null);
        setNavUrl("");
        setOtp(null);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Something went wrong while canceling reservation.");
    } finally {
      setLoading(false);
    }
  };

  const getMessageType = () => {
    if (message.includes("✅")) return "success";
    if (message.includes("⚠️")) return "warning";
    if (message.includes("❌")) return "error";
    return "info";
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle size={20} />;
      case "warning":
        return <AlertTriangle size={20} />;
      case "error":
        return <XCircle size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getMessageStyles = (type) => {
    const baseStyles = {
      padding: "16px 20px",
      borderRadius: "14px",
      marginTop: "20px",
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      fontWeight: 600,
      fontSize: "0.95rem",
      lineHeight: "1.5",
      border: "2px solid",
      whiteSpace: "pre-line",
      boxShadow: "0 10px 30px rgba(2,6,23,0.4)",
      backgroundClip: "padding-box",
    };

    switch (type) {
      case "success":
        return {
          ...baseStyles,
          backgroundColor: "#072f1f", // deep teal tint
          borderColor: "rgba(16,185,129,0.16)",
          color: "#a7f3d0",
        };
      case "warning":
        return {
          ...baseStyles,
          backgroundColor: "rgba(255,246,230,0.06)",
          borderColor: "rgba(245,158,11,0.12)",
          color: "#f59e0b",
        };
      case "error":
        return {
          ...baseStyles,
          backgroundColor: "rgba(255,235,238,0.03)",
          borderColor: "rgba(239,68,68,0.12)",
          color: "#fecaca",
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: "rgba(6,30,40,0.06)",
          borderColor: "rgba(6,182,212,0.12)",
          color: "#bfebff",
        };
    }
  };

  return (
    <div
      className="reservation-root"
      style={{
        minHeight: "100vh",
        padding: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #071124 0%, #0f2937 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? "translateY(0)" : "translateY(12px)",
        transition: "all 480ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 920 }}>
        {/* Top header card */}
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            padding: "28px",
            marginBottom: 20,
            background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "0 20px 60px rgba(2,6,23,0.6)",
            overflow: "hidden",
          }}
        >
          {/* decorative glow */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-30% -10%",
              background:
                "radial-gradient(circle at 10% 20%, rgba(6,182,212,0.06), transparent 15%), radial-gradient(circle at 90% 80%, rgba(99,102,241,0.05), transparent 15%), radial-gradient(circle at 50% 60%, rgba(16,185,129,0.04), transparent 15%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 18, alignItems: "center" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                boxShadow: "0 8px 26px rgba(99,102,241,0.12)",
              }}
            >
              <Zap size={34} style={{ color: "white" }} />
            </div>

            <div style={{ flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  color: "#e6f8ff",
                  fontSize: "1.9rem",
                  lineHeight: 1.05,
                  fontWeight: 800,
                  background: "linear-gradient(135deg,#06b6d4 0%, #6366f1 60%, #10b981 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Confirm Reservation
              </h1>
              <p style={{ margin: "6px 0 0 0", color: "#98b7c6", fontSize: "0.98rem" }}>
                Secure your charging slot — payment, confirmation and navigation in one flow.
              </p>
            </div>

            <div style={{ textAlign: "right", minWidth: 140 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: "linear-gradient(90deg, rgba(6,182,212,0.06), rgba(99,102,241,0.03))",
                  border: "1px solid rgba(255,255,255,0.03)",
                  color: "#dff9ff",
                  fontWeight: 700,
                }}
              >
                <Car size={16} /> <Battery size={16} /> Ready
              </div>
            </div>
          </div>
        </div>

        {/* Main two-column area */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Left: Form card */}
          <div
            style={{
              borderRadius: 16,
              padding: 24,
              background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.04)",
              boxShadow: "0 20px 60px rgba(2,6,23,0.6)",
            }}
          >
            {/* Station info */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                marginBottom: 18,
                padding: "14px",
                borderRadius: 12,
                background: "linear-gradient(90deg, rgba(6,182,212,0.03), rgba(99,102,241,0.02))",
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#06b6d4,#6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 28px rgba(6,182,212,0.06)",
                }}
              >
                <Zap size={22} color="#fff" />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ color: "#dff9ff", fontWeight: 700, fontSize: 15 }}>Charging Station</div>
                <div style={{ color: "#98b7c6", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  <MapPin size={14} /> <span>Station ID: {stationId}</span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <label style={{ display: "block", color: "#bfeffb", fontWeight: 700, marginBottom: 8 }}>
                <Clock size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))",
                  color: "#dff9ff",
                  fontSize: 15,
                  marginBottom: 10,
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 4px rgba(6,182,212,0.08)")}
                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
              />
              <div style={{ color: "#8faebf", fontSize: 13, marginBottom: 18 }}>
                Minimum 15 minutes — increments of 15 minutes
              </div>

              <button
                type="submit"
                disabled={loading || hasActiveReservation}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: hasActiveReservation || loading ? "linear-gradient(90deg,#334155,#334155)" : "linear-gradient(135deg,#06b6d4,#6366f1)",
                  color: "#021018",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: hasActiveReservation || loading ? "not-allowed" : "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: hasActiveReservation || loading ? "none" : "0 10px 30px rgba(99,102,241,0.18)",
                  marginBottom: hasActiveReservation ? 12 : 0,
                }}
                onMouseEnter={(e) => {
                  if (!loading && !hasActiveReservation) {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 16px 40px rgba(6,182,212,0.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !hasActiveReservation) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 10px 30px rgba(99,102,241,0.18)";
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader size={18} style={{ animation: "spin 1s linear infinite", color: "#ffffff" }} /> Processing...
                  </>
                ) : hasActiveReservation ? (
                  <>
                    <CheckCircle size={18} /> Reservation Active
                  </>
                ) : (
                  <>
                    <Car size={18} /> <Battery size={18} /> Reserve Slot
                  </>
                )}
              </button>

              {/* Cancel button */}
              {hasActiveReservation && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.04)",
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    color: "#fff",
                    fontWeight: 700,
                    marginTop: 8,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 8px 26px rgba(220,38,38,0.12)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} /> Cancel Reservation
                </button>
              )}
            </form>
          </div>

          {/* Right column: OTP + navigation + summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* OTP / Access Code */}
            <div
              style={{
                borderRadius: 14,
                padding: 18,
                background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.04)",
                boxShadow: "0 18px 48px rgba(2,6,23,0.5)",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Key size={20} color="#fff" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#dff9ff", fontWeight: 800 }}>Access Code</div>
                  <div style={{ color: "#98b7c6", fontSize: 13 }}>OTP to open the charger</div>
                </div>
              </div>

              {otp ? (
                <>
                  <div
                    style={{
                      marginTop: 6,
                      padding: "12px 10px",
                      borderRadius: 12,
                      background: "linear-gradient(90deg, rgba(16,185,129,0.06), rgba(6,182,212,0.03))",
                      border: "1px solid rgba(16,185,129,0.12)",
                      color: "#a7f3d0",
                      fontSize: 26,
                      fontWeight: 900,
                      letterSpacing: 6,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace",
                    }}
                  >
                    {otp}
                  </div>
                  <div style={{ marginTop: 8, color: "#98b7c6", fontSize: 13 }}>Use this code at the station kiosk</div>
                </>
              ) : (
                <div style={{ color: "#98b7c6", fontSize: 13 }}>No active access code</div>
              )}
            </div>

            {/* Navigation CTA */}
            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: "linear-gradient(135deg,#10b981,#06b6d4)",
                  color: "#021018",
                  fontWeight: 800,
                  textDecoration: "none",
                  boxShadow: "0 12px 36px rgba(6,182,212,0.12)",
                }}
              >
                <Navigation size={18} /> Open Directions in Google Maps
              </a>
            )}

            {/* Quick Info card */}
            <div
              style={{
                borderRadius: 14,
                padding: 16,
                background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.03)",
                boxShadow: "0 14px 40px rgba(2,6,23,0.5)",
                color: "#cfeffb",
                fontWeight: 600,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#06b6d4,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "#e6f8ff", fontWeight: 800 }}>Reservation Summary</div>
                  <div style={{ fontSize: 13, color: "#98b7c6" }}>Quick overview before you confirm</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ color: "#98b7c6", fontSize: 13 }}>Duration</div>
                <div style={{ color: "#dff9ff", fontWeight: 800, textAlign: "right" }}>{duration} mins</div>

                <div style={{ color: "#98b7c6", fontSize: 13 }}>Station</div>
                <div style={{ color: "#dff9ff", fontWeight: 800, textAlign: "right" }}>#{stationId}</div>

                <div style={{ color: "#98b7c6", fontSize: 13 }}>Payment</div>
                <div style={{ color: "#dff9ff", fontWeight: 800, textAlign: "right" }}>Secure (Razorpay)</div>
              </div>
            </div>

            {/* small helpful tip */}
            <div style={{ color: "#98b7c6", fontSize: 13, textAlign: "center" }}>
              Tip: Allow location access for faster reservation and accurate ETA.
            </div>
          </div>
        </div>

        {/* Message bar */}
        {message && (
          <div style={{ maxWidth: 920 }}>
            <div style={getMessageStyles(getMessageType())}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{getMessageIcon(getMessageType())}</div>
              <div style={{ marginLeft: 6, color: "inherit", flex: 1 }}>{message}</div>
            </div>
          </div>
        )}
      </div>

      {/* Inline global styles used by this component */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 980px) {
            .reservation-root > div > div {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ReservationForm;
