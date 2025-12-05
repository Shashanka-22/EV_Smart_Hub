import React, { useState, useEffect } from "react";
import {
  getRecommendedStations,
  createReservation,
  cancelReservation,
  createPaymentOrder,
  verifyPayment,
  predictAvailability,
} from "../api/api";

const Preferences = () => {
  const [preferences, setPreferences] = useState({
    price: 33,
    distance: 33,
    fast_charger: 34,
  });

  const [location, setLocation] = useState({ lat: null, lng: null });
  const [topStations, setTopStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [reservedStationId, setReservedStationId] = useState(null);
  const [duration, setDuration] = useState(30);
  const [otp, setOtp] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [loadingPredict, setLoadingPredict] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);

  // Page fade-in animation
  useEffect(() => {
    setFadeIn(true);
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setLocation({ lat: 0, lng: 0 })
      );
    }
  }, []);

  // Handle slider change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: Number(value) }));
  };

  // Fetch top stations
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.lat || !location.lng) return alert("Location not found.");

    setLoading(true);
    try {
      const data = await getRecommendedStations({ preferences, location });
      setTopStations(data?.top_stations || []);
    } catch (err) {
      console.error(err);
      setTopStations([]);
    } finally {
      setLoading(false);
    }
  };

  // Load Razorpay SDK
  const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject("Failed to load Razorpay SDK");
      document.body.appendChild(script);
    });

  // Handle prediction
  const handlePredict = async (station) => {
    setLoadingPredict(station.id);
    setPredictions((prev) => ({ ...prev, [station.id]: null }));

    try {
      const res = await predictAvailability({
        station_id: station.id,
        user_lat: location.lat,
        user_lng: location.lng,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setPredictions((prev) => ({ ...prev, [station.id]: res }));
      }
    } catch (err) {
      console.error("Prediction error:", err);
      alert("Failed to check availability.");
    } finally {
      setLoadingPredict(null);
    }
  };

  // Reserve + Payment flow
  const handleReserve = async (station) => {
    setLoading(true);
    setMessage("");

    try {
      await loadRazorpayScript();

      const orderRes = await createPaymentOrder({
        station_id: station.id,
        duration: duration,
      });
      if (orderRes.error) throw new Error(orderRes.error);

      const { order, razorpay_key } = orderRes;

      const paymentId = await new Promise((resolve, reject) => {
        const options = {
          key: razorpay_key,
          amount: order.amount,
          currency: order.currency,
          name: "EV ChargeSmart",
          description: `Reservation at ${station.name}`,
          order_id: order.id,
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
        rzp.on("payment.failed", (resp) =>
          reject(resp.error?.description || "Payment failed")
        );
        rzp.open();
      });

      const res = await createReservation({
        station_id: station.id,
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
          `✅ Reservation confirmed at ${station.name}!\nETA: ${new Date(
            res.eta_time
          ).toLocaleTimeString()} | Expires at: ${new Date(
            res.expires_at
          ).toLocaleTimeString()}\nYour OTP: ${res.otp}`
        );
        setHasActiveReservation(true);
        setActiveReservationId(res.reservation_id);
        setReservedStationId(station.id);
      }
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err.message || "Failed to reserve station."}`);
    } finally {
      setLoading(false);
    }
  };

  // Cancel reservation
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
        setReservedStationId(null);
        setOtp(null);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Something went wrong while canceling reservation.");
    } finally {
      setLoading(false);
    }
  };

  // Get message style based on content
  const getMessageStyle = (messageContent) => {
    if (messageContent.includes('✅')) {
      return {
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
        border: '1px solid #22c55e',
        color: '#065f46',
        boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
      };
    } else if (messageContent.includes('❌')) {
      return {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
        border: '1px solid #ef4444',
        color: '#7f1d1d',
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
      };
    } else if (messageContent.includes('⚠️')) {
      return {
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
        border: '1px solid #f59e0b',
        color: '#78350f',
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
      };
    } else {
      return {
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(37, 99, 235, 0.05))',
        border: '1px solid #2563eb',
        color: '#1e3a8a',
        boxShadow: '0 0 20px rgba(37, 99, 235, 0.2)',
      };
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.8s ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* EV Watermark Background */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: '10%',
          transform: 'translateY(-50%)',
          fontSize: '200px',
          opacity: '0.03',
          color: '#2563eb',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        🚗
      </div>

      {/* Main Glassmorphism Container */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          padding: '40px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '40px',
            background: 'linear-gradient(135deg, #2563eb, #22c55e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 36px)',
              fontWeight: '700',
              marginBottom: '10px',
              lineHeight: '1.2',
            }}
          >
            ⚡ Smart EV Charging Management
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: '#4b5563',
              fontWeight: '500',
            }}
          >
            Set Your Station Scoring Preferences
          </p>
        </div>

        {/* Preferences Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '30px',
              marginBottom: '30px',
            }}
          >
            {[
              { key: 'price', icon: '💲', label: 'Price Priority' },
              { key: 'distance', icon: '📍', label: 'Distance Priority' },
              { key: 'fast_charger', icon: '⚡', label: 'Fast Charger Priority' },
            ].map(({ key, icon, label }) => (
              <div key={key} style={{ position: 'relative' }}>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{icon}</span>
                      {label}
                    </label>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #2563eb, #22c55e)',
                        color: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        minWidth: '50px',
                        textAlign: 'center',
                        boxShadow: '0 4px 8px rgba(37, 99, 235, 0.3)',
                      }}
                    >
                      {preferences[key]}%
                    </div>
                  </div>
                  
                  <div style={{ position: 'relative' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      name={key}
                      value={preferences[key]}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: `linear-gradient(to right, #2563eb 0%, #22c55e ${preferences[key]}%, #e5e7eb ${preferences[key]}%, #e5e7eb 100%)`,
                        outline: 'none',
                        appearance: 'none',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                      }}
                    />
                    <style>
                      {`
                        input[type="range"]::-webkit-slider-thumb {
                          appearance: none;
                          width: 20px;
                          height: 20px;
                          border-radius: 50%;
                          background: linear-gradient(135deg, #2563eb, #22c55e);
                          cursor: pointer;
                          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.4);
                          border: 3px solid #ffffff;
                          transition: transform 0.2s ease;
                        }
                        input[type="range"]::-webkit-slider-thumb:hover {
                          transform: scale(1.1);
                        }
                        input[type="range"]::-moz-range-thumb {
                          width: 20px;
                          height: 20px;
                          border-radius: 50%;
                          background: linear-gradient(135deg, #2563eb, #22c55e);
                          cursor: pointer;
                          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.4);
                          border: 3px solid #ffffff;
                          transition: transform 0.2s ease;
                        }
                      `}
                    </style>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Duration Input */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
              marginBottom: '30px',
              maxWidth: '400px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <label
                htmlFor="duration"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  minWidth: 'max-content',
                }}
              >
                <span style={{ fontSize: '20px' }}>⏱</span>
                Duration (minutes):
              </label>
              <input
                type="number"
                id="duration"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{
                  background: 'linear-gradient(135deg, #1f2937, #374151)',
                  color: '#00ff00',
                  border: '2px solid #22c55e',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '18px',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  width: '120px',
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #2563eb, #22c55e)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading 
                ? 'none' 
                : '0 8px 16px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px) scale(1.02)';
                e.target.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.boxShadow = '0 8px 16px rgba(37, 99, 235, 0.3)';
              }
            }}
            onMouseDown={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0) scale(0.98)';
              }
            }}
            onMouseUp={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px) scale(1.02)';
              }
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Processing...
              </>
            ) : (
              <>
                🔍 Save & Get Top Stations
              </>
            )}
          </button>

          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </form>

        {/* Recommended Stations */}
        {topStations.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h3
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🚉</span>
              Top 3 Recommended Stations
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '24px',
              }}
            >
              {topStations.map((station, idx) => {
                const isReservedStation = hasActiveReservation && station.id === reservedStationId;
                const prediction = predictions[station.id];
                const isTopStation = idx === 0;

                return (
                  <div
                    key={station.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '20px',
                      border: isTopStation 
                        ? '2px solid #22c55e' 
                        : '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: isTopStation
                        ? '0 0 30px rgba(34, 197, 94, 0.3), 0 12px 24px rgba(0, 0, 0, 0.1)'
                        : '0 12px 24px rgba(0, 0, 0, 0.1)',
                      padding: '24px',
                      transition: 'all 0.4s ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = isTopStation
                        ? '0 0 40px rgba(34, 197, 94, 0.4), 0 20px 40px rgba(0, 0, 0, 0.15)'
                        : '0 20px 40px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = isTopStation
                        ? '0 0 30px rgba(34, 197, 94, 0.3), 0 12px 24px rgba(0, 0, 0, 0.1)'
                        : '0 12px 24px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    {isTopStation && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          color: '#ffffff',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        ⭐ TOP PICK
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                      }}
                    >
                      <div>
                        <h4
                          style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#1f2937',
                            marginBottom: '4px',
                          }}
                        >
                          #{idx + 1} {station.name}
                        </h4>
                        <p
                          style={{
                            color: '#6b7280',
                            fontSize: '14px',
                            fontWeight: '500',
                          }}
                        >
                          📍 {station.location}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                        marginBottom: '20px',
                      }}
                    >
                      <div
                        style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>💲</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb' }}>
                          ₹{station.price_per_kwh}/kWh
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>📍</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e' }}>
                          {station.distance_km?.toFixed(1) ?? 'N/A'} km
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⚡</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b' }}>
                          {station.has_fast_charger ? 'Fast' : 'Normal'}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'rgba(168, 85, 247, 0.1)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⭐</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#8b5cf6' }}>
                          {station.final_score?.toFixed(1) ?? 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Predict Button */}
                    <button
                      onClick={() => handlePredict(station)}
                      disabled={loadingPredict === station.id}
                      style={{
                        width: '100%',
                        background: loadingPredict === station.id
                          ? '#9ca3af'
                          : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: loadingPredict === station.id ? 'not-allowed' : 'pointer',
                        marginBottom: '16px',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (loadingPredict !== station.id) {
                          e.target.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (loadingPredict !== station.id) {
                          e.target.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {loadingPredict === station.id ? (
                        <>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #ffffff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              display: 'inline-block',
                              marginRight: '8px',
                            }}
                          />
                          Checking Availability...
                        </>
                      ) : (
                        '🔮 Check Availability Prediction'
                      )}
                    </button>

                    {/* Prediction Results */}
                    {prediction && (
                      <div
                        style={{
                          background: prediction.can_reserve
                            ? 'rgba(34, 197, 94, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                          border: prediction.can_reserve
                            ? '1px solid #22c55e'
                            : '1px solid #ef4444',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '16px',
                          boxShadow: prediction.can_reserve
                            ? '0 0 20px rgba(34, 197, 94, 0.2)'
                            : '0 0 20px rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>
                            {prediction.can_reserve ? '✅' : '❌'}
                          </span>
                          <span
                            style={{
                              fontWeight: '600',
                              color: prediction.can_reserve ? '#065f46' : '#7f1d1d',
                            }}
                          >
                            {prediction.message}
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: '14px',
                            color: prediction.can_reserve ? '#065f46' : '#7f1d1d',
                            marginBottom: '12px',
                          }}
                        >
                          🔌 Predicted free slots: {prediction.predicted_free_slots}
                        </p>

                        {/* Action Buttons */}
                        {!hasActiveReservation ? (
                          prediction.can_reserve ? (
                            <button
                              onClick={() => handleReserve(station)}
                              disabled={loading}
                              style={{
                                background: loading 
                                  ? '#9ca3af' 
                                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                outline: 'none',
                                width: '100%',
                              }}
                              onMouseEnter={(e) => {
                                if (!loading) {
                                  e.target.style.transform = 'scale(1.02)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!loading) {
                                  e.target.style.transform = 'scale(1)';
                                }
                              }}
                            >
                              {loading ? '⏳ Processing...' : '💳 Reserve & Pay'}
                            </button>
                          ) : (
                            <p
                              style={{
                                color: '#7f1d1d',
                                fontSize: '14px',
                                fontWeight: '600',
                                textAlign: 'center',
                                padding: '10px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '8px',
                              }}
                            >
                              ❌ Reservation not available
                            </p>
                          )
                        ) : isReservedStation ? (
                          <button
                            onClick={handleCancel}
                            disabled={loading}
                            style={{
                              background: loading 
                                ? '#9ca3af' 
                                : 'linear-gradient(135deg, #ef4444, #dc2626)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              transition: 'all 0.3s ease',
                              outline: 'none',
                              width: '100%',
                            }}
                            onMouseEnter={(e) => {
                              if (!loading) {
                                e.target.style.transform = 'scale(1.02)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!loading) {
                                e.target.style.transform = 'scale(1)';
                              }
                            }}
                          >
                            {loading ? '⏳ Canceling...' : '❌ Cancel Reservation'}
                          </button>
                        ) : (
                          <div
                            style={{
                              color: '#6b7280',
                              fontSize: '14px',
                              textAlign: 'center',
                              padding: '10px',
                              background: 'rgba(107, 114, 128, 0.1)',
                              borderRadius: '8px',
                            }}
                          >
                            🔒 You have an active reservation elsewhere
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div
            style={{
              ...getMessageStyle(message),
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              fontSize: '16px',
              fontWeight: '500',
              whiteSpace: 'pre-line',
              lineHeight: '1.5',
            }}
          >
            {message}
          </div>
        )}

        {/* OTP Display */}
        {otp && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(245, 158, 11, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '24px' }}>🔑</span>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#78350f',
                }}
              >
                Your Access Code
              </span>
            </div>
            <div
              style={{
                background: 'linear-gradient(135deg, #1f2937, #374151)',
                color: '#00ff00',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '32px',
                fontWeight: '700',
                fontFamily: 'monospace',
                letterSpacing: '4px',
                border: '2px solid #22c55e',
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
              }}
            >
              {otp}
            </div>
            <p
              style={{
                fontSize: '14px',
                color: '#78350f',
                marginTop: '8px',
                fontWeight: '500',
              }}
            >
              Present this code at the charging station
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Preferences;