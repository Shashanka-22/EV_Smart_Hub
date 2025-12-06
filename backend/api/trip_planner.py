# 📄 backend/api/trip_planner.py
from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
import requests
import polyline
import math
import os

trip_bp = Blueprint("trip", __name__)

# --------------------------
# Load ENV key (backend .env)
# --------------------------
GOOGLE_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 🔹 Simple fallback coordinates for common places (for demo / when Google fails)
HARDCODED_PLACES = {
    "bengaluru": (12.9716, 77.5946),
    "bengaluru, karnataka, india": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "mysuru": (12.2958, 76.6394),
    "mysuru, karnataka, india": (12.2958, 76.6394),
    "mysore": (12.2958, 76.6394),
}


# ---------------------- Helpers ---------------------- #
def haversine(lat1, lon1, lat2, lon2):
    """Distance in KM between 2 GPS coordinates."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def classify_speed_factor(speed_kmh):
    """EV efficiency adjustment based on speed (Realistic Model-B)."""
    if speed_kmh <= 0:
        return 1.2
    if speed_kmh < 25:
        return 1.5      # city traffic
    if speed_kmh < 60:
        return 1.1      # normal mixed
    if speed_kmh <= 100:
        return 0.9      # highway efficient
    return 1.05         # high speed penalty


def interpolate_line(start_lat, start_lng, end_lat, end_lng, steps=20):
    """Create a simple straight line path between two points."""
    path = []
    for i in range(steps + 1):
        t = i / steps
        lat = start_lat + (end_lat - start_lat) * t
        lng = start_lng + (end_lng - start_lng) * t
        path.append((lat, lng))
    return path


# -------------------- GEOCODING -------------------- #
def geocode_address(query):
    """
    1) Try Google Geocoding API.
    2) If that fails (API disabled / restricted / key issue),
       fall back to HARDCODED_PLACES for demo.
    """
    q_norm = (query or "").strip()
    if not q_norm:
        return None

    # 1️⃣ Try Google if key available
    if GOOGLE_API_KEY:
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {"address": q_norm, "key": GOOGLE_API_KEY}
            res = requests.get(url, params=params, timeout=10)
            data = res.json()

            print("📌 Geocode status:", data.get("status"))

            if data.get("status") == "OK" and data.get("results"):
                result = data["results"][0]
                return {
                    "formatted": result["formatted_address"],
                    "lat": result["geometry"]["location"]["lat"],
                    "lng": result["geometry"]["location"]["lng"],
                }
        except Exception as e:
            print("Geocoding exception:", e)

    # 2️⃣ Fallback – hardcoded cities (for demo)
    key = q_norm.lower()
    if key in HARDCODED_PLACES:
        lat, lng = HARDCODED_PLACES[key]
        return {
            "formatted": q_norm,
            "lat": lat,
            "lng": lng,
        }

    print("⚠ Geocode failed for:", q_norm)
    return None


def find_corridor_stations(path_coords, stations, corridor_km=6.0):
    """Return stations within corridor_km from any point on route path."""
    corridor = []
    for s in stations:
        s_lat = float(s["latitude"])
        s_lng = float(s["longitude"])

        for p_lat, p_lng in path_coords:
            if haversine(s_lat, s_lng, p_lat, p_lng) <= corridor_km:
                corridor.append(s)
                break

    return corridor


# ---------------------- MAIN ENDPOINT ---------------------- #
@trip_bp.route("/plan", methods=["POST"])
def plan_trip():
    data = request.get_json(silent=True) or {}

    start = data.get("start")
    end = data.get("end")
    soc = float(data.get("soc", 60))
    max_range = float(data.get("max_range", 320))

    # 1️⃣ Check minimal input
    if not start or not end:
        return jsonify({"error": "Start and destination are required"}), 400

    # 2️⃣ Geocode (with fallback)
    start_geo = geocode_address(start)
    end_geo = geocode_address(end)

    if not start_geo or not end_geo:
        return jsonify({"error": "Invalid start or destination address"}), 400

    start_fixed = start_geo["formatted"]
    end_fixed = end_geo["formatted"]
    s_lat, s_lng = start_geo["lat"], start_geo["lng"]
    e_lat, e_lng = end_geo["lat"], end_geo["lng"]

    # 3️⃣ Try Google Directions API
    path_coords = None
    total_km = 0.0
    total_min = 0.0

    if GOOGLE_API_KEY:
        try:
            url = "https://maps.googleapis.com/maps/api/directions/json"
            params = {
                "origin": f"{s_lat},{s_lng}",
                "destination": f"{e_lat},{e_lng}",
                "mode": "driving",
                "key": GOOGLE_API_KEY,
            }
            directions = requests.get(url, params=params, timeout=10).json()
            print("📌 Directions status:", directions.get("status"))

            if directions.get("status") == "OK" and directions.get("routes"):
                route = directions["routes"][0]
                legs = route["legs"]
                overview_poly = route["overview_polyline"]["points"]
                path_coords = polyline.decode(overview_poly)

                for leg in legs:
                    km = leg["distance"]["value"] / 1000.0
                    minutes = leg["duration"]["value"] / 60.0
                    total_km += km
                    total_min += minutes
            else:
                print("⚠ Directions API not OK, falling back to straight line.")
        except Exception as e:
            print("Directions API exception, falling back:", e)

    # 4️⃣ Fallback route if Directions API fails
    if path_coords is None:
        # straight line between start & end
        path_coords = interpolate_line(s_lat, s_lng, e_lat, e_lng, steps=20)
        total_km = haversine(s_lat, s_lng, e_lat, e_lng)
        # assume avg 40 km/h
        total_min = (total_km / 40.0) * 60.0

        # create a fake polyline just for completeness
        overview_poly = polyline.encode(path_coords)

    # 5️⃣ Energy model
    total_soc_used = 0.0
    km_per_percent = max_range / 100.0 if max_range > 0 else 3.0

    # approximate per-segment based on global avg speed
    avg_speed = (total_km / (total_min / 60.0)) if total_min > 0 else 40.0
    eff_factor = classify_speed_factor(avg_speed)

    # SOC for entire trip
    total_soc_used = (total_km / km_per_percent) * eff_factor
    arrival_soc = max(soc - total_soc_used, 0.0)

    # 6️⃣ Load stations
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name, latitude, longitude, fast_charger FROM stations")
    stations = cur.fetchall()
    conn.close()

    # 7️⃣ Corridor stations
    corridor = find_corridor_stations(path_coords, stations)

    # 8️⃣ Charging stops along the path
    stops = []
    remaining_soc = soc
    reserve = 15.0

    for i in range(len(path_coords) - 1):
        lat1, lng1 = path_coords[i]
        lat2, lng2 = path_coords[i + 1]

        step_km = haversine(lat1, lng1, lat2, lng2)
        step_soc = (step_km / km_per_percent) * eff_factor
        projected_soc = remaining_soc - step_soc

        if projected_soc <= reserve + 3.0:
            if not corridor:
                break

            nearest = min(
                corridor,
                key=lambda s: haversine(
                    lat2, lng2, float(s["latitude"]), float(s["longitude"])
                ),
            )

            station_lat = float(nearest["latitude"])
            station_lng = float(nearest["longitude"])
            dist_from_route = haversine(lat2, lng2, station_lat, station_lng)

            arrival_soc_at_station = max(projected_soc, 0.0)
            target_soc = 80.0
            delta_soc = max(target_soc - arrival_soc_at_station, 0.0)

            is_fast = bool(nearest.get("fast_charger", 0))
            charge_rate = 1.5 if is_fast else 1.0  # % per minute
            charge_minutes = max(20, int(delta_soc / charge_rate))

            stops.append(
                {
                    "station_id": nearest["id"],
                    "station_name": nearest["name"],
                    "latitude": station_lat,
                    "longitude": station_lng,
                    "distance_from_route_km": round(dist_from_route, 2),
                    "arrival_soc": round(arrival_soc_at_station, 1),
                    "recommended_charge_minutes": charge_minutes,
                    "post_charge_soc": target_soc,
                    "is_fast_charger": is_fast,
                }
            )

            remaining_soc = target_soc
        else:
            remaining_soc = projected_soc

    return jsonify(
        {
            "route_polyline": overview_poly,
            "path": path_coords,
            "total_distance_km": round(total_km, 1),
            "total_duration_min": int(total_min),
            "initial_soc": round(soc, 1),
            "estimated_soc_used": round(total_soc_used, 1),
            "arrival_soc": round(arrival_soc, 1),
            "stops": stops,
            "start_fixed": start_fixed,
            "end_fixed": end_fixed,
            "message": "Trip plan generated (Google or fallback)",
        }
    ), 200
