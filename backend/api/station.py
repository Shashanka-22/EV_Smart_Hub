# 📄 backend/api/station.py

from flask import Blueprint, request, jsonify
from backend.db_config import get_db_connection
import jwt, os, math
from datetime import datetime
from flask_cors import CORS

# ------------------------------------------------
# 🔧 Blueprint
# ------------------------------------------------
station_bp = Blueprint("station", __name__)

CORS(
    station_bp,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")


# ------------------------------------------------
# ⚡ Surge Pricing
# ------------------------------------------------
def apply_simple_surge(base_price):
    hour = datetime.now().hour

    if 6 <= hour <= 10 or 17 <= hour <= 21:
        surge_factor = 1.3
        label = "HIGH DEMAND"
    else:
        surge_factor = 1.0
        label = "OFF-PEAK"

    return {
        "surge_factor": surge_factor,
        "dynamic_price": round(base_price * surge_factor, 2),
        "label": label
    }


# ------------------------------------------------
# 🔐 Helpers
# ------------------------------------------------
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id"), payload.get("role")
    except:
        return None, None


def get_auth_info():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return decode_token(token)


# ------------------------------------------------
# 📍 Distance
# ------------------------------------------------
def calculate_distance(lat1, lon1, lat2, lon2):
    try:
        lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
        R = 6371
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2) ** 2 +
            math.cos(math.radians(lat1)) *
            math.cos(math.radians(lat2)) *
            math.sin(d_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except:
        return 0


def get_travel_time(user_lat, user_lng, station_lat, station_lng):
    distance_km = calculate_distance(user_lat, user_lng, station_lat, station_lng)
    return max(1, int((distance_km / 40) * 60))



# ================================
# 1️⃣ GET ALL APPROVED STATIONS
# ================================
@station_bp.route("", methods=["GET"])
def get_all_stations():

    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # ⭐ UPDATED: Adding owner details
    cursor.execute("""
        SELECT 
            s.*, 
            u.username AS owner_name,
            u.email AS owner_email,
            u.phone_number AS owner_phone
        FROM stations s
        LEFT JOIN users u ON s.owner_id = u.id
        WHERE s.status = 'approved'
    """)

    stations = cursor.fetchall()
    cursor.close()
    conn.close()

    for s in stations:
        s["latitude"] = float(s["latitude"])
        s["longitude"] = float(s["longitude"])
        s["price_per_kwh"] = float(s["price_per_kwh"])

        surge = apply_simple_surge(s["price_per_kwh"])
        s.update(surge)

        if user_lat:
            s["distance_km"] = calculate_distance(
                user_lat, user_lng, s["latitude"], s["longitude"]
            )
            s["eta_mins"] = get_travel_time(
                user_lat, user_lng, s["latitude"], s["longitude"]
            )

    return jsonify(stations), 200



# ================================
# 2️⃣ GET SINGLE APPROVED STATION
# ================================
@station_bp.route("/<int:station_id>", methods=["GET"])
def get_station_by_id(station_id):

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.*, 
            u.username AS owner_name,
            u.email AS owner_email,
            u.phone_number AS owner_phone
        FROM stations s
        LEFT JOIN users u ON s.owner_id = u.id
        WHERE s.id=%s AND s.status='approved'
    """, (station_id,))

    station = cursor.fetchone()
    cursor.close()
    conn.close()

    if not station:
        return jsonify({"error": "Station not found"}), 404

    station["latitude"] = float(station["latitude"])
    station["longitude"] = float(station["longitude"])
    station["price_per_kwh"] = float(station["price_per_kwh"])

    surge = apply_simple_surge(station["price_per_kwh"])
    station.update(surge)

    return jsonify(station), 200



# ================================
# 3️⃣ NEAREST APPROVED STATIONS
# ================================
@station_bp.route("/nearest", methods=["GET"])
def get_nearest_stations():

    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)

    if user_lat is None or user_lng is None:
        return jsonify({"error": "lat & lng required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.*, 
            u.username AS owner_name,
            u.email AS owner_email,
            u.phone_number AS owner_phone
        FROM stations s
        LEFT JOIN users u ON s.owner_id = u.id
        WHERE s.status='approved'
    """)

    stations = cursor.fetchall()
    cursor.close()
    conn.close()

    for s in stations:
        s["latitude"] = float(s["latitude"])
        s["longitude"] = float(s["longitude"])

        surge = apply_simple_surge(float(s["price_per_kwh"]))
        s.update(surge)

        s["distance_km"] = calculate_distance(
            user_lat, user_lng, s["latitude"], s["longitude"]
        )
        s["eta_mins"] = get_travel_time(
            user_lat, user_lng, s["latitude"], s["longitude"]
        )

    stations.sort(key=lambda x: x["distance_km"])
    return jsonify(stations[:3]), 200




# ================================
# 4️⃣ SMART SCORE ENDPOINT
# ================================
@station_bp.route("/score-stations", methods=["POST"])
def score_stations():

    data = request.get_json() or {}
    user_lat = data.get("lat")
    user_lng = data.get("lng")

    if not user_lat or not user_lng:
        return jsonify({"error": "lat & lng required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.*, 
            u.username AS owner_name,
            u.email AS owner_email,
            u.phone_number AS owner_phone
        FROM stations s
        LEFT JOIN users u ON s.owner_id = u.id
        WHERE s.status='approved'
    """)

    stations = cursor.fetchall()
    cursor.close()
    conn.close()

    scored = []

    for s in stations:
        lat = float(s["latitude"])
        lng = float(s["longitude"])
        price = float(s["price_per_kwh"])

        surge = apply_simple_surge(price)

        distance = calculate_distance(user_lat, user_lng, lat, lng)
        eta = get_travel_time(user_lat, user_lng, lat, lng)

        score = (
            (5 - min(distance, 5)) * 2 +
            (50 - eta) * 0.1 +
            (1 if s.get("fast_charger") else 0) * 3 +
            (surge["surge_factor"] == 1.0) * 2
        )

        s.update({
            "score": round(score, 2),
            "distance_km": distance,
            "eta_mins": eta,
            "dynamic_price": surge["dynamic_price"],
            "surge_label": surge["label"],
        })

        scored.append(s)

    scored.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({"stations": scored}), 200



# ================================
# 5️⃣ OWNER — MY STATIONS
# ================================
@station_bp.route("/mine", methods=["GET"])
def get_owner_stations():

    user_id, _ = get_auth_info()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.*, 
            u.username AS owner_name,
            u.email AS owner_email,
            u.phone_number AS owner_phone
        FROM stations s
        LEFT JOIN users u ON s.owner_id = u.id
        WHERE s.owner_id=%s
        ORDER BY s.created_at DESC
    """, (user_id,))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(rows), 200



# ================================
# 6️⃣ CREATE STATION
# ================================
@station_bp.route("/create", methods=["POST"])
def create_station():

    user_id, _ = get_auth_info()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}

    required = ["name", "location", "latitude", "longitude", "total_slots", "price_per_kwh"]
    for f in required:
        if f not in data:
            return jsonify({"error": f"{f} is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO stations (
            owner_id, name, location, latitude, longitude, total_slots, price_per_kwh,
            fast_charger, status
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'pending')
    """, (
        user_id,
        data["name"],
        data["location"],
        data["latitude"],
        data["longitude"],
        data["total_slots"],
        data["price_per_kwh"],
        1 if data.get("fast_charger") else 0,
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Station submitted for admin approval"}), 200



# ================================
# 7️⃣ UPDATE STATION
# ================================
@station_bp.route("/<int:station_id>", methods=["PUT"])
def update_station(station_id):

    user_id, _ = get_auth_info()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT owner_id FROM stations WHERE id=%s", (station_id,))
    owner = cursor.fetchone()

    if not owner:
        return jsonify({"error": "Station not found"}), 404

    if owner["owner_id"] != user_id:
        return jsonify({"error": "Not your station"}), 403

    cursor.execute("""
        UPDATE stations SET 
            name=%s,
            location=%s,
            latitude=%s,
            longitude=%s,
            total_slots=%s,
            price_per_kwh=%s,
            fast_charger=%s,
            status='pending'
        WHERE id=%s
    """, (
        data["name"],
        data["location"],
        data["latitude"],
        data["longitude"],
        data["total_slots"],
        data["price_per_kwh"],
        1 if data.get("fast_charger") else 0,
        station_id
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Station updated & pending approval"}), 200



# ================================
# 8️⃣ DELETE STATION
# ================================
@station_bp.route("/<int:station_id>", methods=["DELETE"])
def delete_station(station_id):

    user_id, _ = get_auth_info()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT owner_id FROM stations WHERE id=%s", (station_id,))
    owner = cursor.fetchone()

    if not owner:
        return jsonify({"error": "Station not found"}), 404

    if owner["owner_id"] != user_id:
        return jsonify({"error": "Not your station"}), 403

    cursor.execute("DELETE FROM stations WHERE id=%s", (station_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Station deleted"}), 200
