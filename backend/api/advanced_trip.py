from flask import Blueprint, request, jsonify
from backend.db_config import get_db_connection
import math

advanced_trip_bp = Blueprint("advanced_trip", __name__)

# --------------------------
# Haversine Distance
# --------------------------
def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng/2)**2
    return 2 * R * math.asin(math.sqrt(a))

# --------------------------
# Get all stations from DB
# --------------------------
def load_stations():
    db = get_db_connection()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM stations")
    data = cur.fetchall()
    cur.close()
    db.close()
    return data

# --------------------------
# Pick the best station
# --------------------------
def choose_station_on_route(stations, lat, lng, remaining_range):
    best = None
    best_score = 9999999

    for s in stations:
        dist = haversine(lat, lng, s["latitude"], s["longitude"])

        if dist > remaining_range:
            continue  # unreachable

        # scoring system
        score = dist
        if s["fast_charger"]:
            score -= 5  # prefer fast chargers

        if s["price_per_kwh"] < 25:
            score -= 2  # cheaper station bonus

        if score < best_score:
            best_score = score
            best = s

    return best


# --------------------------
# ADVANCED TRIP PLANNER
# --------------------------
@advanced_trip_bp.route("/advanced-trip", methods=["POST"])
def plan_advanced_trip():
    data = request.json

    start = data["start"]
    end = data["end"]
    battery = float(data["battery"])
    max_range = float(data["max_range"])  # km full battery

    stations = load_stations()

    trip_stops = []

    # convert battery% → km
    remaining_range = (battery / 100) * max_range

    # Step 1: distance from start → end
    direct_dist = haversine(
        start["lat"], start["lng"],
        end["lat"], end["lng"]
    )

    # If reachable directly
    if direct_dist <= remaining_range:
        return jsonify({
            "distance": round(direct_dist, 2),
            "stops": [],
            "message": "Direct route possible"
        })

    # Otherwise add a charging station
    current_lat = start["lat"]
    current_lng = start["lng"]

    while True:
        station = choose_station_on_route(stations, current_lat, current_lng, remaining_range)

        if not station:
            return jsonify({"error": "No reachable charging stations", "stops": trip_stops}), 400

        station_dist = haversine(current_lat, current_lng, station["latitude"], station["longitude"])

        arrival_soc = max(0, round((station_dist / max_range) * 100, 1))

        # charging calculation
        charge_needed = 70  # charge until 70%
        rate = 1 if station["fast_charger"] else 0.4
        charge_time = int((charge_needed - (100 - battery)) / rate)

        # add stop
        trip_stops.append({
            "name": station["name"],
            "latitude": station["latitude"],
            "longitude": station["longitude"],
            "arrival_soc": arrival_soc,
            "charge_time": charge_time,
            "price": station["price_per_kwh"]
        })

        # recharge battery
        battery = charge_needed
        remaining_range = (battery / 100) * max_range

        # test if destination is now reachable
        dist_to_end = haversine(
            station["latitude"], station["longitude"],
            end["lat"], end["lng"]
        )

        if dist_to_end <= remaining_range:
            break

        current_lat = station["latitude"]
        current_lng = station["longitude"]

    return jsonify({
        "total_stops": len(trip_stops),
        "stops": trip_stops,
        "message": "Advanced trip generated"
    })
