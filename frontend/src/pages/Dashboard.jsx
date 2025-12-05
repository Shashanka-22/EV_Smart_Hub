import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import StationCard from "../components/StationCard";
import {
  getMyReservations,
  cancelReservation,
  getStations,
  createReservation,
} from "../api/api";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Zap,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
  Navigation,
  Loader,
  TrendingUp,
  Battery,
  Gauge,
  ChevronRight,
  X,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng]);
  return null;
}

function AutoFitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !markers || markers.length === 0) return;
    const bounds = L.latLngBounds(
      markers.map((m) => [m.latitude, m.longitude])
    );
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, markers]);
  return null;
}

const Dashboard = () => {
  const { user } = useAuth();

  const [nearestStations, setNearestStations] = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  const [now, setNow] = useState(new Date());
  const [userLocation, setUserLocation] = useState(null);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingAllStations, setLoadingAllStations] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [selectedStation, setSelectedStation] = useState(null);
  const mapRef = useRef();

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  const displayName = user?.email
    ? user.email.split("@")[0]
    : user?.sub || "User";

  const formatDateIST = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCountdown = (targetTime) => {
    const diff = new Date(targetTime).getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const fetchReservations = async () => {
    try {
      const res = await getMyReservations();
      if (Array.isArray(res)) {
        const active = res.find(
          (r) => r.status === "active" || r.charging_status === "running"
        );
        setActiveReservation(active || null);
      }
    } catch (err) {
      console.error("Failed to load reservations", err);
    }
  };

  useEffect(() => {
    fetchReservations();
    const tick = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(fetchReservations, 60000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 12.9716, lng: 77.5946 });
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn("Geolocation error", err);
        setUserLocation({ lat: 12.9716, lng: 77.5946 });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoadingAllStations(true);
      try {
        const res = await getStations();
        if (Array.isArray(res)) {
          setAllStations(res.map((s) => ({ ...s, id: s.id || s.station_id })));
        } else {
          const r = await axios.get("http://localhost:5000/api/stations");
          if (Array.isArray(r.data))
            setAllStations(
              r.data.map((s) => ({ ...s, id: s.id || s.station_id }))
            );
        }
      } catch (err) {
        console.error("Failed to load stations", err);
      } finally {
        setLoadingAllStations(false);
      }
    };
    loadAll();
  }, []);

  useEffect(() => {
    const fetchNearest = async () => {
      if (!userLocation || activeReservation) {
        setNearestStations([]);
        setLoadingStations(false);
        return;
      }
      try {
        setLoadingStations(true);
        const res = await axios.get(
          `http://localhost:5000/api/stations/nearest?lat=${userLocation.lat}&lng=${userLocation.lng}`
        );
        if (Array.isArray(res.data)) {
          setNearestStations(
            res.data.map((s) => ({
              ...s,
              id: s.id || s.station_id,
              distance_km: s.distance_km?.toFixed(2),
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching nearest stations", err);
      } finally {
        setLoadingStations(false);
      }
    };
    fetchNearest();
  }, [userLocation, activeReservation]);

  const handleCancel = async (id) => {
    try {
      await cancelReservation(id);
      setActiveReservation(null);
      fetchReservations();
    } catch (err) {
      console.error("Cancel failed", err);
    }
  };

  const handleBookFromMap = async (station) => {
    if (activeReservation) return;
    if (!userLocation) {
      alert("User location is required");
      return;
    }
    try {
      const body = {
        station_id: station.id || station.station_id,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      };
      const res = await createReservation(body);
      if (res && res.reservation_id) {
        await fetchReservations();
        alert("Reservation created!");
      } else if (res && res.error) {
        alert(`Failed: ${res.error}`);
      } else {
        fetchReservations();
      }
    } catch (err) {
      console.error("Booking failed", err);
    }
  };

  const disableBooking = Boolean(activeReservation);
  const isCharging = activeReservation?.charging_status === "running";
  const isCompleted = activeReservation?.charging_status === "completed";

  let chargingEndTime = null;
  if (
    isCharging &&
    activeReservation?.charging_start_time &&
    activeReservation?.duration_mins
  ) {
    chargingEndTime =
      new Date(activeReservation.charging_start_time).getTime() +
      activeReservation.duration_mins * 60000;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #0f3f5c 100%)",
        padding: isMobile ? "16px" : "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#fff",
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 100%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        .glow-pulse {
          animation: pulse 3s ease-in-out infinite;
        }
        button:active {
          transform: scale(0.98);
        }
      `}</style>

      {/* Header */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        style={{
          marginBottom: "40px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            padding: "12px 24px",
            borderRadius: "50px",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          <Zap size={24} style={{ color: "#22c55e" }} />
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#22c55e" }}>
            EV Charging Network
          </span>
        </motion.div>

        <h1
          style={{
            fontSize: isMobile ? "32px" : "48px",
            fontWeight: "800",
            marginBottom: "8px",
            background: "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Power Up Your Journey
        </h1>

        <p
          style={{
            fontSize: isMobile ? "16px" : "18px",
            color: "rgba(255,255,255,0.7)",
            marginBottom: "24px",
          }}
        >
          Welcome back, <span style={{ color: "#22c55e", fontWeight: "600" }}>{displayName}</span>! Reserve your charging slot instantly.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Active Reservation Card */}
        {activeReservation && !isCompleted && (
          <motion.div
            variants={itemVariants}
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "24px",
              padding: isMobile ? "24px" : "32px",
              border: "1px solid rgba(255,255,255,0.15)",
              marginBottom: "32px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at top right, rgba(34,197,94,0.1), transparent)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <Battery size={28} style={{ color: "#22c55e" }} />
                <h2
                  style={{
                    fontSize: "28px",
                    fontWeight: "700",
                    margin: 0,
                  }}
                >
                  Active Charging Session
                </h2>
              </div>

              {isCharging && (
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{
                    background: "linear-gradient(90deg, rgba(34,197,94,0.2), rgba(6,182,212,0.2))",
                    border: "1px solid rgba(34,197,94,0.4)",
                    borderRadius: "16px",
                    padding: "16px",
                    marginBottom: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <Zap
                    size={20}
                    style={{
                      color: "#22c55e",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <span style={{ fontWeight: "600" }}>
                    ⚡ Charging in Progress – Stay Connected!
                  </span>
                </motion.div>
              )}

              <div
                style={{
                  fontSize: isMobile ? "24px" : "28px",
                  fontWeight: "700",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <MapPin size={24} style={{ color: "#06b6d4" }} />
                {activeReservation.station_name ||
                  `Station #${activeReservation.station_id}`}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                {!isCharging ? (
                  <>
                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Reservation Time
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>
                        {formatDateIST(activeReservation.eta_time)}
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Expires At
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>
                        {formatDateIST(activeReservation.expire_time)}
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Time Remaining
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#fbbf24",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Clock size={18} />
                        {getCountdown(activeReservation.expire_time)}
                      </div>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Duration
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>
                        {activeReservation.duration_mins} min
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Ends At
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>
                        {chargingEndTime
                          ? formatDateIST(chargingEndTime)
                          : formatDateIST(activeReservation.expire_time)}
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ translateY: -4 }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                          fontWeight: "600",
                        }}
                      >
                        Time Left
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#22c55e",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Zap size={18} />
                        {chargingEndTime
                          ? getCountdown(chargingEndTime)
                          : getCountdown(activeReservation.expire_time)}
                      </div>
                    </motion.div>
                  </>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                {!isCharging && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCancel(activeReservation.id)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      background: "rgba(239,68,68,0.2)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      color: "#ff6b6b",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(239,68,68,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(239,68,68,0.2)";
                    }}
                  >
                    <X size={18} />
                    Cancel Reservation
                  </motion.button>
                )}

                {!isCharging && userLocation && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${activeReservation.latitude},${activeReservation.longitude}&travelmode=driving`,
                        "_blank"
                      )
                    }
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                      border: "none",
                      color: "#fff",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Navigation size={18} />
                    Navigate
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Map Card */}
        <motion.div
          variants={itemVariants}
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            borderRadius: "24px",
            padding: isMobile ? "20px" : "28px",
            border: "1px solid rgba(255,255,255,0.15)",
            marginBottom: "32px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <MapPin size={28} style={{ color: "#06b6d4" }} />
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "700",
                margin: 0,
              }}
            >
              Nearby Stations
            </h2>
          </div>

          <div
            style={{
              height: isMobile ? "350px" : "500px",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              position: "relative",
            }}
          >
            {userLocation ? (
              <MapContainer
                center={[userLocation.lat, userLocation.lng]}
                zoom={15}
                minZoom={13}
                maxZoom={19}
                style={{ height: "100%", width: "100%" }}
                dragging={!disableBooking}
                scrollWheelZoom={!disableBooking}
                doubleClickZoom={!disableBooking}
                zoomControl={!disableBooking}
              >
                <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={L.icon({
                    iconUrl:
                      "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                  })}
                >
                  <Popup>Your Location</Popup>
                </Marker>

                {allStations.map((s) => (
                  <Marker
                    key={s.id}
                    position={[s.latitude, s.longitude]}
                    opacity={disableBooking ? 0.4 : 1}
                  >
                    <Popup minWidth={240}>
                      <div
                        style={{
                          fontWeight: "700",
                          fontSize: "16px",
                          marginBottom: "12px",
                          color: "#1f2937",
                        }}
                      >
                        {s.name || s.station_name || `Station ${s.id}`}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          marginBottom: "8px",
                          color: "#6b7280",
                        }}
                      >
                        📍 {s.location}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          marginBottom: "8px",
                          color: "#374151",
                        }}
                      >
                        <strong>Base:</strong> ₹{s.price_per_kwh}/kWh
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          marginBottom: "8px",
                          color: "#dc2626",
                          fontWeight: "700",
                        }}
                      >
                        Dynamic: ₹{s.dynamic_price} (×{s.surge_factor})
                      </div>

                      <div
                        style={{
                          padding: "6px 12px",
                          display: "inline-block",
                          borderRadius: "8px",
                          background:
                            s.label === "HIGH DEMAND"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(34,197,94,0.15)",
                          color:
                            s.label === "HIGH DEMAND" ? "#dc2626" : "#16a34a",
                          fontSize: "12px",
                          fontWeight: "600",
                          marginBottom: "10px",
                        }}
                      >
                        {s.label}
                      </div>

                      <div style={{ fontSize: "13px", marginTop: "12px", color: "#374151" }}>
                        Slots: <strong>{s.total_slots}</strong>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "12px",
                        }}
                      >
                        <button
                          disabled={disableBooking}
                          onClick={() => handleBookFromMap(s)}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: disableBooking
                              ? "#9ca3af"
                              : "#22c55e",
                            color: "#fff",
                            border: "none",
                            cursor: disableBooking ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            fontSize: "12px",
                          }}
                        >
                          {disableBooking ? "Active" : "Book"}
                        </button>

                        <button
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${s.latitude},${s.longitude}&travelmode=driving`,
                              "_blank"
                            )
                          }
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "12px",
                          }}
                        >
                          Navigate
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <Loader
                  size={32}
                  style={{
                    animation: "spin 1s linear infinite",
                  }}
                />
              </div>
            )}

            {disableBooking && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "16px",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    color: "#fff",
                  }}
                >
                  <AlertCircle size={40} style={{ marginBottom: "12px" }} />
                  <div style={{ fontWeight: "700", fontSize: "16px" }}>
                    Active Reservation
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    Booking is disabled
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Nearest Stations */}
        {!activeReservation && (
          <motion.div
            variants={itemVariants}
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "24px",
              padding: isMobile ? "20px" : "28px",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <TrendingUp size={28} style={{ color: "#22c55e" }} />
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  margin: 0,
                }}
              >
                Top Nearest Stations
              </h2>
            </div>

            {loadingStations ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : isTablet
                    ? "repeat(2, 1fr)"
                    : "repeat(3, 1fr)",
                  gap: "20px",
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{
                      height: "280px",
                      borderRadius: "16px",
                    }}
                  />
                ))}
              </div>
            ) : nearestStations.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <Gauge size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
                <div style={{ fontSize: "16px", fontWeight: "600" }}>
                  No stations found nearby
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : isTablet
                    ? "repeat(2, 1fr)"
                    : "repeat(3, 1fr)",
                  gap: "20px",
                }}
              >
                {nearestStations.map((station, idx) => (
                  <motion.div
                    key={station.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ translateY: -8 }}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "16px",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.1)";
                      e.currentTarget.style.border =
                        "1px solid rgba(255,255,255,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                      e.currentTarget.style.border =
                        "1px solid rgba(255,255,255,0.1)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "start",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "700",
                            marginBottom: "4px",
                          }}
                        >
                          {station.station_name || `Station ${station.id}`}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <MapPin size={14} />
                          {station.distance_km} km away
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "6px 12px",
                          background: "rgba(34,197,94,0.2)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#22c55e",
                        }}
                      >
                        {station.label || "Available"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "12px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          marginBottom: "6px",
                        }}
                      >
                        Pricing
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          Base: ₹{station.price_per_kwh}
                        </span>
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: "700",
                            color: "#fbbf24",
                          }}
                        >
                          ₹{station.dynamic_price}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBookFromMap(station)}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "10px",
                          background:
                            "linear-gradient(135deg, #22c55e, #16a34a)",
                          border: "none",
                          color: "#fff",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          fontSize: "13px",
                        }}
                      >
                        <Zap size={16} />
                        Book Now
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${station.latitude},${station.longitude}&travelmode=driving`,
                            "_blank"
                          )
                        }
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          color: "#fff",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          fontSize: "13px",
                        }}
                      >
                        <Navigation size={16} />
                        Go
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;