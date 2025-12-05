import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  GoogleMap,
  Polyline,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import {
  Zap,
  Loader2,
  Navigation,
  MapPin,
  X,
  AlertCircle,
  Battery,
  Clock,
  Route as RouteIcon,
} from "lucide-react";

/* ============================================================================
   🎨 THEME & CONFIGURATION
   Replace API key, adjust color tokens, animation timing here
   ========================================================================== */

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const API_ENDPOINT = "http://localhost:5000/api/trip/plan";
const DEBOUNCE_DELAY = 300;

const libraries = ["places"];

const mapContainerStyle = {
  height: "100%",
  width: "100%",
  borderRadius: "16px",
  minHeight: "400px",
};

const polylineOptions = {
  strokeColor: "#06b6d4",
  strokeOpacity: 1,
  strokeWeight: 4,
  geodesic: true,
};

/* ============================================================================
   🎯 MAIN COMPONENT
   ========================================================================== */

export default function TripPlanner() {
  // Form state
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [soc, setSoc] = useState(60);
  const [maxRange, setMaxRange] = useState(320);

  // Route state
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  // UI state
  const [errorMsg, setErrorMsg] = useState("");
  const [showError, setShowError] = useState(false);
  const [activeField, setActiveField] = useState(null);

  // Refs
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const debounceTimer = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Init Google Places services
  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      const map = new window.google.maps.Map(document.createElement("div"));
      autocompleteService.current =
        new window.google.maps.places.AutocompleteService();
      placesService.current = new window.google.maps.places.PlacesService(map);
    }
  }, [isLoaded]);

  // Debounced autocomplete
  const fetchSuggestions = useCallback((inputText, setter) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!inputText || !autocompleteService.current) {
      setter([]);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      autocompleteService.current.getPlacePredictions(
        {
          input: inputText,
          componentRestrictions: { country: "in" },
          types: ["geocode"],
        },
        (predictions) => {
          if (predictions) setter(predictions);
          else setter([]);
        }
      );
    }, DEBOUNCE_DELAY);
  }, []);

  const handleSelect = (placeId, setter, clearList) => {
    if (!placesService.current) return;

    placesService.current.getDetails(
      {
        placeId,
        fields: ["formatted_address", "geometry"],
      },
      (place) => {
        if (place?.formatted_address) {
          setter(place.formatted_address);
        }
      }
    );
    clearList([]);
    setActiveField(null);
  };

  const planTrip = async () => {
    setErrorMsg("");
    setShowError(false);

    if (!start || !end) {
      setErrorMsg("Please select both Start and Destination.");
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    if (soc < 10 || soc > 100) {
      setErrorMsg("Battery level must be between 10% and 100%.");
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(API_ENDPOINT, {
        start,
        end,
        soc: Number(soc),
        max_range: Number(maxRange),
      });

      setRoute(res.data);
    } catch (err) {
      console.error("Trip plan error:", err);
      setErrorMsg(
        err?.response?.data?.error || "Trip planning failed. Please try again."
      );
      setShowError(true);
      setTimeout(() => setShowError(false), 6000);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = () => {
    if (!start || !end) return;

    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        start
      )}&destination=${encodeURIComponent(end)}&travelmode=driving`,
      "_blank"
    );
  };

  const formatDuration = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const clearStart = () => {
    setStart("");
    setStartSuggestions([]);
  };

  const clearEnd = () => {
    setEnd("");
    setEndSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      planTrip();
    }
    if (e.key === "Escape") {
      setActiveField(null);
      setStartSuggestions([]);
      setEndSuggestions([]);
    }
  };

  const center =
    route?.path?.length > 0
      ? { lat: route.path[0][0], lng: route.path[0][1] }
      : { lat: 20.5937, lng: 78.9629 };

  /* ==========================================================================
     🎨 RENDER
     ======================================================================== */

  return (
    <div className="trip-planner-root">
      {/* Error Toast */}
      {showError && (
        <div className="error-toast" role="alert" aria-live="assertive">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
          <button
            onClick={() => setShowError(false)}
            aria-label="Close error"
            className="error-close"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <Zap size={32} className="header-icon" />
            <h1 className="header-title">EV Trip Planner</h1>
          </div>
          <p className="header-subtitle">
            Plan your journey with optimal charging stops
          </p>
        </header>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left Panel - Trip Details */}
          <div className="card panel-left">
            <h2 className="card-title">
              <RouteIcon size={20} />
              Trip Details
            </h2>

            {/* Start Location */}
            <div className="form-group">
              <label htmlFor="start-input" className="form-label">
                <MapPin size={14} />
                Start Location
              </label>
              <div className="input-wrapper">
                <input
                  id="start-input"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    fetchSuggestions(e.target.value, setStartSuggestions);
                  }}
                  onFocus={() => setActiveField("start")}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter start location"
                  className="input"
                  aria-autocomplete="list"
                  aria-controls="start-suggestions"
                  aria-expanded={startSuggestions.length > 0}
                />
                {start && (
                  <button
                    onClick={clearStart}
                    className="input-clear"
                    aria-label="Clear start location"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Start Suggestions Dropdown */}
              {startSuggestions.length > 0 && activeField === "start" && (
                <div
                  id="start-suggestions"
                  className="suggestions-dropdown"
                  role="listbox"
                >
                  {startSuggestions.map((s) => (
                    <div
                      key={s.place_id}
                      onClick={() =>
                        handleSelect(s.place_id, setStart, setStartSuggestions)
                      }
                      className="suggestion-item"
                      role="option"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSelect(
                            s.place_id,
                            setStart,
                            setStartSuggestions
                          );
                        }
                      }}
                    >
                      <MapPin size={16} className="suggestion-icon" />
                      <span>{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Destination */}
            <div className="form-group">
              <label htmlFor="end-input" className="form-label">
                <MapPin size={14} />
                Destination
              </label>
              <div className="input-wrapper">
                <input
                  id="end-input"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    fetchSuggestions(e.target.value, setEndSuggestions);
                  }}
                  onFocus={() => setActiveField("end")}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter destination"
                  className="input"
                  aria-autocomplete="list"
                  aria-controls="end-suggestions"
                  aria-expanded={endSuggestions.length > 0}
                />
                {end && (
                  <button
                    onClick={clearEnd}
                    className="input-clear"
                    aria-label="Clear destination"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* End Suggestions Dropdown */}
              {endSuggestions.length > 0 && activeField === "end" && (
                <div
                  id="end-suggestions"
                  className="suggestions-dropdown"
                  role="listbox"
                >
                  {endSuggestions.map((s) => (
                    <div
                      key={s.place_id}
                      onClick={() =>
                        handleSelect(s.place_id, setEnd, setEndSuggestions)
                      }
                      className="suggestion-item"
                      role="option"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSelect(s.place_id, setEnd, setEndSuggestions);
                        }
                      }}
                    >
                      <MapPin size={16} className="suggestion-icon" />
                      <span>{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Battery & Range */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="soc-input" className="form-label">
                  <Battery size={14} />
                  Battery (%)
                </label>
                <input
                  id="soc-input"
                  type="number"
                  min="10"
                  max="100"
                  value={soc}
                  onChange={(e) => setSoc(Number(e.target.value))}
                  onKeyDown={handleKeyDown}
                  className="input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="range-input" className="form-label">
                  <RouteIcon size={14} />
                  Max Range (km)
                </label>
                <input
                  id="range-input"
                  type="number"
                  min="50"
                  max="1000"
                  value={maxRange}
                  onChange={(e) => setMaxRange(Number(e.target.value))}
                  onKeyDown={handleKeyDown}
                  className="input"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="button-group">
              <button
                onClick={planTrip}
                disabled={loading || !start || !end}
                className="btn btn-primary"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Planning...</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    <span>Plan Trip</span>
                  </>
                )}
              </button>

              <button
                onClick={openInMaps}
                disabled={!start || !end}
                className="btn btn-secondary"
              >
                <Navigation size={16} />
                <span>Open in Maps</span>
              </button>
            </div>
          </div>

          {/* Right Panel - Summary & Results */}
          <div className="panel-right">
            {/* Route Summary */}
            <div className="card summary-card">
              <h3 className="card-subtitle">
                <RouteIcon size={18} />
                Route Summary
              </h3>
              {loading ? (
                <div className="skeleton-group">
                  <div className="skeleton skeleton-line"></div>
                  <div className="skeleton skeleton-line"></div>
                </div>
              ) : route ? (
                <div className="summary-stats">
                  <div className="stat-item">
                    <RouteIcon size={16} className="stat-icon" />
                    <div>
                      <div className="stat-label">Distance</div>
                      <div className="stat-value">{route.total_distance_km} km</div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <Clock size={16} className="stat-icon" />
                    <div>
                      <div className="stat-label">Duration</div>
                      <div className="stat-value">
                        {formatDuration(route.total_duration_min)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="empty-state">Plan a trip to see route details</p>
              )}
            </div>

            {/* Battery Forecast */}
            <div className="card battery-card">
              <h3 className="card-subtitle battery-title">
                <Battery size={18} />
                Battery Forecast
              </h3>
              {loading ? (
                <div className="skeleton-group">
                  <div className="skeleton skeleton-line"></div>
                  <div className="skeleton skeleton-line"></div>
                  <div className="skeleton skeleton-line"></div>
                </div>
              ) : route ? (
                <div className="battery-stats">
                  <div className="battery-stat">
                    <span className="battery-label">Start</span>
                    <span className="battery-value">{route.initial_soc}%</span>
                  </div>
                  <div className="battery-divider">→</div>
                  <div className="battery-stat">
                    <span className="battery-label">Used</span>
                    <span className="battery-value used">
                      {route.estimated_soc_used}%
                    </span>
                  </div>
                  <div className="battery-divider">→</div>
                  <div className="battery-stat">
                    <span className="battery-label">Arrival</span>
                    <span className="battery-value arrival">{route.arrival_soc}%</span>
                  </div>
                </div>
              ) : (
                <p className="empty-state">Battery data will appear here</p>
              )}
            </div>

            {/* Charging Stops */}
            <div className="card stops-card">
              <h3 className="card-subtitle">
                <Zap size={18} />
                Charging Stops
                {route?.stops?.length > 0 && (
                  <span className="stops-badge">{route.stops.length}</span>
                )}
              </h3>

              {loading ? (
                <div className="skeleton-group">
                  <div className="skeleton skeleton-box"></div>
                  <div className="skeleton skeleton-box"></div>
                </div>
              ) : route?.stops?.length > 0 ? (
                <div className="stops-list">
                  {route.stops.map((stop, i) => (
                    <div key={i} className="stop-item">
                      <div className="stop-header">
                        <div className="stop-number">{i + 1}</div>
                        <div className="stop-info">
                          <div className="stop-name">{stop.station_name}</div>
                          <div className="stop-meta">
                            <span>Arrival: {stop.arrival_soc}%</span>
                            <span>•</span>
                            <span>{stop.recommended_charge_minutes} min</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const dest = `${stop.latitude},${stop.longitude}`;
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              dest
                            )}&travelmode=driving`,
                            "_blank"
                          );
                        }}
                        className="btn btn-stop"
                      >
                        <Navigation size={14} />
                        <span>Navigate</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No charging stops required</p>
              )}
            </div>
          </div>
        </div>

        {/* Map Section */}
        {isLoaded && (
          <div className="map-container">
            <GoogleMap
              center={center}
              zoom={route?.path ? 7 : 5}
              mapContainerStyle={mapContainerStyle}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
              }}
            >
              {route?.path && (
                <>
                  <Polyline
                    path={route.path.map(([lat, lng]) => ({
                      lat,
                      lng,
                    }))}
                    options={polylineOptions}
                  />

                  <Marker
                    position={{
                      lat: route.path[0][0],
                      lng: route.path[0][1],
                    }}
                    label={{
                      text: "S",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  />

                  <Marker
                    position={{
                      lat: route.path[route.path.length - 1][0],
                      lng: route.path[route.path.length - 1][1],
                    }}
                    label={{
                      text: "D",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  />

                  {route.stops?.map((stop, idx) => (
                    <Marker
                      key={stop.station_id || idx}
                      position={{ lat: stop.latitude, lng: stop.longitude }}
                      label={{
                        text: "⚡",
                        fontSize: "16px",
                      }}
                      animation={window.google.maps.Animation.DROP}
                    />
                  ))}
                </>
              )}
            </GoogleMap>
          </div>
        )}
      </div>

      {/* =========================================================================
          🎨 INLINE STYLES WITH CSS VARIABLES - dark/glass theme, teal/cyan/green
          ====================================================================== */}
      <style>{`
        .trip-planner-root {
          --bg-1: #071024;
          --bg-2: #0f2b3f;
          --card-glass: rgba(255,255,255,0.04);
          --card-border: rgba(255,255,255,0.08);

          --accent-cyan: #06b6d4;
          --accent-indigo: #6366f1;
          --accent-green: #22c55e;
          --accent-yellow: #fbbf24;

          --text-on-dark: rgba(255,255,255,0.95);
          --muted-on-dark: rgba(255,255,255,0.7);
          --muted-2: rgba(255,255,255,0.55);

          --surface: rgba(255,255,255,0.96);
          --surface-opaque: rgba(255,255,255,0.98);
          --border: rgba(255,255,255,0.06);

          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --radius-xl: 20px;

          --spacing-xs: 6px;
          --spacing-sm: 12px;
          --spacing-md: 18px;
          --spacing-lg: 26px;
          --spacing-xl: 36px;

          --shadow-soft: 0 8px 30px rgba(2,6,23,0.6);
          --shadow-lg: 0 20px 60px rgba(2,6,23,0.7);

          --transition-fast: 150ms cubic-bezier(0.33,1,0.68,1);
          --transition-base: 220ms cubic-bezier(0.33,1,0.68,1);
        }

        .trip-planner-root * { box-sizing: border-box; }

        body { background: transparent; }

        .trip-planner-root {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 100%);
          padding: var(--spacing-lg);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: var(--text-on-dark);
        }

        .container { max-width: 1400px; margin: 0 auto; }

        .header { text-align: center; margin-bottom: var(--spacing-xl); }
        .header-content { display:flex; align-items:center; justify-content:center; gap: var(--spacing-md); margin-bottom: 8px; }
        .header-icon { color: var(--accent-cyan); filter: drop-shadow(0 6px 18px rgba(6,182,212,0.12)); }
        .header-title {
          font-size: 2.4rem; font-weight: 800;
          background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .header-subtitle { color: var(--muted-on-dark); margin-top: 6px; }

        .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg); }

        .card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-soft);
          border: 1px solid var(--card-border);
          transition: all var(--transition-base);
          color: var(--text-on-dark);
        }

        .panel-left { min-height: 320px; }
        .panel-right { display:flex; flex-direction: column; gap: var(--spacing-md); }

        .card-title { font-size: 1.25rem; font-weight: 700; display:flex; gap: 10px; align-items:center; color: var(--text-on-dark); margin-bottom: 12px; }

        .card-subtitle { font-size: 1rem; font-weight: 700; color: var(--text-on-dark); margin-bottom: 10px; display:flex; gap:10px; align-items:center; }

        .form-group { margin-bottom: var(--spacing-md); position: relative; }
        .form-label { display:flex; align-items:center; gap:8px; font-size: 0.8rem; color: var(--muted-on-dark); text-transform:uppercase; letter-spacing:0.06em; font-weight:700; margin-bottom:8px; }

        .input-wrapper { position: relative; }
        .input {
          width:100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: var(--text-on-dark);
          font-size: 1rem;
          outline: none;
          transition: box-shadow var(--transition-fast), transform var(--transition-fast);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
        }
        .input:focus { box-shadow: 0 6px 30px rgba(6,182,212,0.06); transform: translateY(-1px); border-color: rgba(6,182,212,0.28); }
        .input:hover { transform: translateY(-1px); }

        .input-clear { position:absolute; right:10px; top:50%; transform:translateY(-50%); background: transparent; border:none; color: var(--muted-on-dark); cursor:pointer; padding:6px; border-radius:8px; }
        .input-clear:hover { color: var(--text-on-dark); background: rgba(255,255,255,0.02); }

        .form-row { display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }

        .suggestions-dropdown {
          position: absolute; top: calc(100% + 8px); left:0; right:0;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.96));
          border-radius: 12px; box-shadow: 0 8px 30px rgba(2,6,23,0.6);
          max-height: 260px; overflow-y:auto; z-index: 60; border: 1px solid rgba(2,6,23,0.08);
        }
        .suggestion-item { padding: 12px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; color: #0f172a; border-bottom: 1px solid rgba(2,6,23,0.03); }
        .suggestion-item:last-child { border-bottom:none; }
        .suggestion-item:hover, .suggestion-item:focus { background: linear-gradient(90deg, rgba(6,182,212,0.06), rgba(99,102,241,0.03)); outline: none; }

        .button-group { display:flex; flex-direction: column; gap: 12px; margin-top: 14px; }
        .btn {
          display:flex; align-items:center; justify-content:center; gap: 10px; padding: 12px 18px;
          border-radius: 9999px; font-weight:700; cursor:pointer; transition: transform var(--transition-fast), box-shadow var(--transition-fast);
          min-height: 48px; border: none;
        }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow:none; }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
          color: #021018;
          box-shadow: 0 10px 30px rgba(6,182,212,0.12);
        }
        .btn-primary:not(:disabled):hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(6,182,212,0.16); }
        .btn-secondary {
          background: rgba(255,255,255,0.04);
          color: var(--muted-on-dark);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .btn-stop {
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo));
          color: white;
          padding: 8px 14px;
          border-radius: 10px;
          display: inline-flex; gap:8px; align-items:center;
        }

        .summary-stats { display:flex; flex-direction: column; gap:12px; }
        .stat-item { display:flex; gap:12px; align-items:center; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; }
        .stat-icon { color: var(--accent-cyan); }
        .stat-label { font-size: 0.75rem; color: var(--muted-on-dark); text-transform: uppercase; }
        .stat-value { font-size: 1.2rem; font-weight: 800; color: var(--text-on-dark); }

        .battery-card {
          background: linear-gradient(135deg, rgba(34,197,94,0.95), rgba(6,182,212,0.92));
          color: #001219;
        }
        .battery-title { color: #001219; }
        .battery-stats { display:flex; align-items:center; gap:12px; }
        .battery-stat { display:flex; flex-direction:column; align-items:center; gap:6px; }
        .battery-label { font-size: 0.75rem; color: rgba(0,0,0,0.65); text-transform: uppercase; }
        .battery-value { font-size: 1.25rem; font-weight: 800; color: #001219; }
        .battery-value.used { color: rgba(0,0,0,0.65); }
        .battery-divider { font-size:1.25rem; opacity:0.8; color: rgba(0,0,0,0.6); }

        .stops-badge { background: linear-gradient(135deg,var(--accent-cyan),var(--accent-indigo)); color: white; padding: 4px 8px; border-radius: 9999px; margin-left:auto; font-weight:800; }
        .stops-list { display:flex; flex-direction:column; gap:12px; }
        .stop-item { background: rgba(255,255,255,0.02); border-radius:12px; padding:12px; border: 1px solid rgba(255,255,255,0.03); display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .stop-item:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
        .stop-header { display:flex; align-items:flex-start; gap:12px; }
        .stop-number { background: linear-gradient(135deg,var(--accent-green),var(--accent-cyan)); color: #001219; width:36px;height:36px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900; }
        .stop-name { font-weight:700; color: var(--text-on-dark); }
        .stop-meta { color: var(--muted-on-dark); display:flex; gap:8px; font-size:0.9rem; }

        .map-container {
          margin-top: var(--spacing-lg);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border-radius: var(--radius-lg);
          padding: 12px;
          box-shadow: var(--shadow-lg);
          border: 1px solid rgba(255,255,255,0.06);
          min-height: 520px;
        }

        .error-toast {
          position: fixed; top: var(--spacing-lg); right: var(--spacing-lg);
          background: linear-gradient(90deg,#ef4444,#dc2626); color: white; padding: 12px 16px; border-radius: 10px;
          box-shadow: 0 10px 40px rgba(2,6,23,0.6); display:flex; gap:12px; align-items:center; z-index:120;
        }
        .error-close { background: transparent; border:none; color:white; cursor:pointer; padding:4px; }

        .empty-state { color: var(--muted-on-dark); text-align:center; padding: 8px 0; }

        .skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%); background-size:200% 100%; animation: shimmer 1.4s linear infinite; border-radius: 8px; }
        .skeleton-line { height: 16px; width: 100%; }
        .skeleton-box { height: 84px; width: 100%; }

        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        @media (max-width: 1024px) {
          .main-grid { grid-template-columns: 1fr; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        .trip-planner-root :focus-visible { outline: 3px solid rgba(6,182,212,0.14); outline-offset: 2px; border-radius: 8px; }
      `}</style>
    </div>
  );
}
