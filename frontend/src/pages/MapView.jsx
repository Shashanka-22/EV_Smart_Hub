// src/pages/MapView.jsx
import React, { useState, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  DirectionsRenderer,
  Marker
} from "@react-google-maps/api";

// Fallback Center (Bangalore)
const fallbackCenter = { lat: 12.9716, lng: 77.5946 };

// DEMO: Replace with your API data later
const stationList = [
  { id: 1, lat: 12.9352, lng: 77.6145, name: "EV Station A" },
  { id: 2, lat: 12.9655, lng: 77.6100, name: "EV Station B" },
  { id: 3, lat: 12.9455, lng: 77.5900, name: "EV Station C" }
];

const MapView = () => {
  const [directions, setDirections] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [userLocation, setUserLocation] = useState(fallbackCenter);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ["places"]
  });

  // Get Live User Location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported. Using fallback...");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        console.warn("Location error:", err);
        setUserLocation(fallbackCenter);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Generate Route
  const getRoute = () => {
    if (!selectedStation) return alert("❗ Select a station first");

    const origin = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    const destination = new window.google.maps.LatLng(
      selectedStation.lat,
      selectedStation.lng
    );

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === "OK") {
          setDirections(result);
        } else {
          alert("Directions request failed: " + status);
        }
      }
    );
  };

  return isLoaded ? (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-3">🚗 Map & Directions</h2>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={getRoute}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Get Route
        </button>

        {selectedStation && (
          <span className="text-gray-700 font-medium">
            Selected: <strong>{selectedStation.name}</strong>
          </span>
        )}
      </div>

      <GoogleMap
        center={userLocation}
        zoom={13}
        mapContainerStyle={{ width: "100%", height: "500px" }}
      >
        {/* User Marker (LIVE LOCATION) */}
        <Marker
          position={userLocation}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
          }}
        />

        {/* Station Markers */}
        {stationList.map((station) => (
          <Marker
            key={station.id}
            position={{ lat: station.lat, lng: station.lng }}
            onClick={() => {
              setSelectedStation(station);
              setDirections(null); // clear previous route
            }}
          />
        ))}

        {/* Route Renderer */}
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>
    </div>
  ) : (
    <p className="text-center text-gray-600">Loading map...</p>
  );
};

export default MapView;
