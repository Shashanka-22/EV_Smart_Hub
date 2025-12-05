import React, { useState } from "react";
import {
  predictAvailability,
  createReservation,
  createPaymentOrder,
  verifyPayment,
} from "../api/api";

const StationCard = ({ station, userLocation, user }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const stationId = station.id || station.station_id;

  // 🔹 Utility: Load Razorpay SDK dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // 🔹 Check availability (predict API via api.js)
  const handlePredict = async () => {
    if (!userLocation) {
      alert("User location not available");
      return;
    }

    setLoading(true);
    setResult(null);

    const res = await predictAvailability({
      station_id: stationId,
      user_lat: userLocation.lat,
      user_lng: userLocation.lng,
    });

    if (res.error) {
      alert(res.error);
    } else {
      setResult(res);
    }

    setLoading(false);
  };

  // 🔹 Final reservation after verified payment
  const handleReserve = async (payment_id) => {
    setReserving(true);
    try {
      const res = await createReservation({
        station_id: stationId,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        payment_id,
      });

      if (res.error) {
        alert(res.error);
      } else {
        alert(res.message || "Reservation successful!");
        setResult(null);
      }
    } catch (err) {
      console.error("Reservation error:", err);
      alert("Reservation failed. Please try again.");
    } finally {
      setReserving(false);
    }
  };

  // 🔹 Payment + Reservation Flow
  const handlePaymentAndReserve = async () => {
    if (!userLocation) {
      alert("User location not available");
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      alert("Failed to load Razorpay SDK. Please check your internet connection.");
      return;
    }

    try {
      const orderRes = await createPaymentOrder({
        station_id: stationId,
        duration: 30,
      });

      if (orderRes.error) {
        alert(orderRes.error);
        return;
      }

      const { order, razorpay_key } = orderRes;

      const options = {
        key: razorpay_key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "EV ChargeSmart",
        description: `Reservation at ${station.name}`,
        handler: async function (response) {
          try {
            const verifyRes = await verifyPayment({
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });

            if (verifyRes.error) {
              alert(verifyRes.error);
              return;
            }

            localStorage.setItem("last_payment_id", verifyRes.payment_id);
            await handleReserve(verifyRes.payment_id);
          } catch (err) {
            console.error("Payment verification failed:", err);
            alert("Payment verification failed. Try again.");
          }
        },
        prefill: {
          email: user?.email || "user@example.com",
        },
        theme: {
          color: "#06b6d4",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment process failed");
    }
  };

  // Calculate slot availability percentage
  const slotPercentage = result
    ? (result.predicted_free_slots / station.total_slots) * 100
    : 0;

  // Determine availability status
  const getAvailabilityStatus = () => {
    if (!result) return null;
    if (slotPercentage >= 50) return { text: "Available", color: "#22c55e" };
    if (slotPercentage >= 20) return { text: "Limited", color: "#f59e0b" };
    return { text: "Busy", color: "#ef4444" };
  };

  const availabilityStatus = getAvailabilityStatus();

  return (
    <>
      <style>
        {`
          /* 🎨 EDIT THESE VARIABLES TO CUSTOMIZE COLORS */
          :root {
            --primary-gradient-start: #06b6d4;
            --primary-gradient-end: #6366f1;
            --success-color: #22c55e;
            --accent-lime: #a3e635;
            --navy-dark: #0b1220;
            --surface-light: #f8fafc;
            --glass-bg: rgba(255, 255, 255, 0.85);
            --glass-border: rgba(255, 255, 255, 0.5);
          }

          /* Glass-morphism Card Animation */
          @keyframes cardFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }

          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          @keyframes slideInFade {
            0% {
              opacity: 0;
              transform: translateY(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(6, 182, 212, 0.5); }
            50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.7); }
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes fillBar {
            from { width: 0%; }
            to { width: var(--target-width); }
          }

          /* Ripple Effect */
          @keyframes ripple {
            0% {
              transform: scale(0);
              opacity: 1;
            }
            100% {
              transform: scale(4);
              opacity: 0;
            }
          }

          /* Respect user preferences for reduced motion */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}
      </style>

      <article
        role="article"
        aria-label={`EV charging station: ${station.name}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: "relative",
          background: "var(--glass-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "18px",
          border: "1px solid var(--glass-border)",
          padding: "28px",
          boxShadow: isHovered
            ? "0 20px 60px rgba(6, 182, 212, 0.2), 0 8px 16px rgba(0, 0, 0, 0.1)"
            : "0 10px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isHovered ? "translateY(-8px)" : "translateY(0)",
          maxWidth: "100%",
        }}
      >
        {/* Decorative Background Radial Highlights */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-50%",
            right: "-20%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)",
            pointerEvents: "none",
            transition: "all 0.6s ease",
            transform: isHovered ? "scale(1.2)" : "scale(1)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-30%",
            left: "-10%",
            width: "250px",
            height: "250px",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Header Section */}
        <header style={{ position: "relative", zIndex: 1, marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Station Info */}
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <h3
                style={{
                  fontSize: "22px",
                  fontWeight: "700",
                  color: "var(--navy-dark)",
                  margin: "0 0 8px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  lineHeight: "1.3",
                  wordBreak: "break-word",
                }}
              >
                {/* Battery Icon */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <rect
                    x="3"
                    y="6"
                    width="16"
                    height="13"
                    rx="2"
                    stroke="url(#batteryGradient)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M21 10v4"
                    stroke="url(#batteryGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <rect x="6" y="9" width="10" height="7" rx="1" fill="url(#batteryGradient)" />
                  <defs>
                    <linearGradient id="batteryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                {station.name}
              </h3>

              {/* Location */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#64748b",
                  fontSize: "14px",
                  marginBottom: "12px",
                }}
              >
                {/* Map Pin Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                    fill="#64748b"
                  />
                </svg>
                <span style={{ lineHeight: "1.4" }}>{station.location}</span>
              </div>

              {/* Total Slots Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)",
                  borderRadius: "10px",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0f172a",
                }}
              >
                {/* Slots Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="none"
                  />
                  <rect
                    x="13"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="none"
                  />
                  <rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="none"
                  />
                  <rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span>
                  <strong>{station.total_slots}</strong> Total Slots
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Action Button: Check Availability */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: "20px" }}>
          <button
            onClick={handlePredict}
            disabled={loading || !userLocation}
            aria-label="Check station availability"
            aria-busy={loading}
            style={{
              position: "relative",
              width: "100%",
              padding: "16px 24px",
              fontSize: "16px",
              fontWeight: "600",
              color: "#ffffff",
              background: loading || !userLocation
                ? "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)"
                : "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
              border: "none",
              borderRadius: "12px",
              cursor: loading || !userLocation ? "not-allowed" : "pointer",
              boxShadow: loading || !userLocation
                ? "0 4px 12px rgba(0, 0, 0, 0.1)"
                : "0 6px 20px rgba(6, 182, 212, 0.3)",
              transition: "all 0.3s ease",
              transform: isHovered && !loading && userLocation ? "translateY(-2px)" : "translateY(0)",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              if (!loading && userLocation) {
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(6, 182, 212, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && userLocation) {
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.3)";
              }
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {loading ? (
                <>
                  {/* Loading Spinner */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ animation: "spin 1s linear infinite" }}
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="4"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  {/* Bolt Icon */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                      fill="#ffffff"
                      stroke="#ffffff"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Check Availability
                </>
              )}
            </span>
          </button>
        </div>

        {/* Loading State with Shimmer */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Checking station availability"
            style={{
              position: "relative",
              padding: "16px",
              borderRadius: "12px",
              background: "linear-gradient(90deg, rgba(6, 182, 212, 0.05) 0%, rgba(99, 102, 241, 0.1) 50%, rgba(6, 182, 212, 0.05) 100%)",
              backgroundSize: "1000px 100%",
              animation: "shimmer 2s infinite linear",
              textAlign: "center",
              fontSize: "14px",
              color: "#475569",
              fontWeight: "500",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#06b6d4",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <span>Checking station availability...</span>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#6366f1",
                  animation: "pulse 1.5s ease-in-out infinite 0.5s",
                }}
              />
            </div>
          </div>
        )}

        {/* Prediction Result Panel */}
        {result && !loading && (
          <section
            role="region"
            aria-label="Availability results"
            style={{
              position: "relative",
              padding: "20px",
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)",
              borderRadius: "14px",
              border: "1px solid rgba(6, 182, 212, 0.15)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              animation: "slideInFade 0.5s ease-out",
              marginBottom: "20px",
            }}
          >
            {/* Status Badge */}
            {availabilityStatus && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  background: `${availabilityStatus.color}20`,
                  border: `1.5px solid ${availabilityStatus.color}`,
                  borderRadius: "8px",
                  marginBottom: "14px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: availabilityStatus.color,
                }}
                role="status"
                aria-label={`Station status: ${availabilityStatus.text}`}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: availabilityStatus.color,
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                {availabilityStatus.text}
              </div>
            )}

            {/* Message */}
            <p
              style={{
                fontSize: "15px",
                lineHeight: "1.6",
                color: "#334155",
                margin: "0 0 16px 0",
                fontWeight: "500",
              }}
            >
              {result.message}
            </p>

            {/* Slot Progress Bar */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Available Slots
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {result.predicted_free_slots} / {station.total_slots}
                </span>
              </div>

              {/* Progress Bar Container */}
              <div
                role="progressbar"
                aria-valuenow={slotPercentage}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`${result.predicted_free_slots} out of ${station.total_slots} slots available`}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "12px",
                  background: "rgba(148, 163, 184, 0.2)",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                {/* Animated Fill */}
                <div
                  style={{
                    height: "100%",
                    width: `${slotPercentage}%`,
                    background: slotPercentage >= 50
                      ? "linear-gradient(90deg, #22c55e 0%, #a3e635 100%)"
                      : slotPercentage >= 20
                      ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
                      : "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
                    borderRadius: "10px",
                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: slotPercentage >= 50
                      ? "0 0 10px rgba(34, 197, 94, 0.4)"
                      : slotPercentage >= 20
                      ? "0 0 10px rgba(245, 158, 11, 0.4)"
                      : "0 0 10px rgba(239, 68, 68, 0.4)",
                  }}
                />
              </div>
            </div>

            {/* Reserve Button with Glow */}
            {result.can_reserve && (
              <button
                onClick={handlePaymentAndReserve}
                disabled={reserving}
                aria-label="Reserve this charging slot"
                aria-busy={reserving}
                style={{
                  position: "relative",
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#ffffff",
                  background: reserving
                    ? "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)"
                    : "linear-gradient(135deg, #22c55e 0%, #a3e635 100%)",
                  border: "none",
                  borderRadius: "12px",
                  cursor: reserving ? "not-allowed" : "pointer",
                  boxShadow: reserving
                    ? "0 4px 12px rgba(0, 0, 0, 0.1)"
                    : "0 6px 20px rgba(34, 197, 94, 0.4)",
                  transition: "all 0.3s ease",
                  animation: reserving ? "none" : "glow 2s ease-in-out infinite",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!reserving) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(34, 197, 94, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!reserving) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(34, 197, 94, 0.4)";
                  }
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  {reserving ? (
                    <>
                      {/* Processing Spinner */}
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ animation: "spin 1s linear infinite" }}
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="rgba(255, 255, 255, 0.3)"
                          strokeWidth="4"
                        />
                        <path
                          d="M12 2a10 10 0 0 1 10 10"
                          stroke="#ffffff"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      </svg>
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      {/* Check Circle Icon */}
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2" />
                        <path
                          d="M8 12l3 3 5-6"
                          stroke="#ffffff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Reserve Now
                    </>
                  )}
                </span>
              </button>
            )}
          </section>
        )}

        {/* Accessibility: Screen reader only text */}
        <span
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
          aria-live="polite"
        >
          {loading && "Loading availability information"}
          {result && `${result.predicted_free_slots} slots available`}
          {reserving && "Processing your reservation"}
        </span>
      </article>
    </>
  );
};

export default StationCard;
