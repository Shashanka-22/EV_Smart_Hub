# 📄 backend/api/owner.py

from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
from ..socketio_instance import socketio
from datetime import datetime, timedelta
from threading import Thread
import time
import os
import jwt

owner_bp = Blueprint("owner", __name__)

# ============================================
# 🔐 JWT HELPERS
# ============================================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")


def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id"), payload.get("role")
    except:
        return None, None


def get_auth_info():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return decode_token(token)


# ===============================================================
# 🔥 LIVE CHARGING PROGRESS EMITTER (Background Thread)
# ===============================================================
def emit_charging_progress(reservation_id, station_id, start_time, end_time):
    """Runs continuously and streams progress % + power + kWh"""

    while True:
        now = datetime.utcnow()
        total_secs = (end_time - start_time).total_seconds()
        remaining_secs = max(0, (end_time - now).total_seconds())

        percent = int((1 - (remaining_secs / total_secs)) * 100)
        power_kw = 7  # fixed charging power

        # energy (kWh) = power × hours
        energy_delivered = round(power_kw * (percent / 100) * (total_secs / 3600), 3)

        socketio.emit("charging_progress", {
            "reservation_id": reservation_id,
            "station_id": station_id,
            "percent": percent,
            "remaining_seconds": remaining_secs,
            "power_kw": power_kw,
            "energy_delivered": energy_delivered
        })

        if remaining_secs <= 0:
            break

        time.sleep(1)


# ===============================================================
# 📌 VERIFY OTP
# ===============================================================
@owner_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.*, u.username, u.email
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        WHERE u.email=%s AND r.otp=%s AND r.status='active'
    """, (email, otp))

    reservation = cursor.fetchone()
    cursor.close()
    conn.close()

    if not reservation:
        return jsonify({"error": "Invalid email or OTP"}), 400

    socketio.emit("otp_verified", {
        "reservation_id": reservation["id"],
        "station_id": reservation["station_id"],
        "email": email
    })

    return jsonify({
        "reservation_id": reservation["id"],
        "username": reservation["username"],
        "user_email": reservation["email"],
        "station_id": reservation["station_id"],
        "duration": reservation["duration"],
        "eta_time": reservation["eta_time"].isoformat() if reservation["eta_time"] else None,
        "expire_time": reservation["expire_time"].isoformat() if reservation.get("expire_time") else None,
        "charging_status": reservation.get("charging_status", "pending"),
        "charging_start_time": reservation["charging_start_time"].isoformat()
        if reservation.get("charging_start_time") else None,
        "charging_end_time": reservation["charging_end_time"].isoformat()
        if reservation.get("charging_end_time") else None,
    })


# ===============================================================
# ⚡ OWNER START CHARGING
# ===============================================================
@owner_bp.route("/start-charging", methods=["POST"])
def start_charging():
    data = request.json
    reservation_id = data.get("reservation_id")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT duration, station_id FROM reservations WHERE id=%s", (reservation_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Reservation not found"}), 404

    duration = row["duration"]
    station_id = row["station_id"]
    start_time = datetime.utcnow()
    expire_time = start_time + timedelta(minutes=duration)

    cursor.execute("""
        UPDATE reservations
        SET charging_status='running',
            charging_start_time=%s,
            expire_time=%s,
            status='active'
        WHERE id=%s
    """, (start_time, expire_time, reservation_id))
    conn.commit()
    cursor.close()
    conn.close()

    # WS: Charging started
    socketio.emit("charging_started", {
        "reservation_id": reservation_id,
        "station_id": station_id,
        "start_time": start_time.isoformat(),
        "expire_time": expire_time.isoformat()
    })

    # Start live progress thread
    Thread(target=emit_charging_progress,
           args=(reservation_id, station_id, start_time, expire_time),
           daemon=True).start()

    return jsonify({
        "message": "Charging started",
        "charging_status": "running",
        "charging_start_time": start_time.isoformat(),
        "expire_time": expire_time.isoformat()
    })


# ===============================================================
# 🛑 OWNER STOP CHARGING
# ===============================================================
@owner_bp.route("/stop-charging", methods=["POST"])
def stop_by_owner():
    return stop_charging_logic(is_user=False)


# ===============================================================
# 🛑 USER STOP CHARGING (NEW FEATURE)
# ===============================================================
@owner_bp.route("/user-stop-charging", methods=["POST"])
def stop_by_user():
    return stop_charging_logic(is_user=True)


# ===============================================================
# 🛑 STOP LOGIC (used by user + owner)
# ===============================================================
def stop_charging_logic(is_user=False):
    data = request.json
    reservation_id = data.get("reservation_id")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT station_id FROM reservations WHERE id=%s", (reservation_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Reservation not found"}), 404

    station_id = row["station_id"]
    end_time = datetime.utcnow()

    cursor.execute("""
        UPDATE reservations
        SET charging_status='completed',
            charging_end_time=%s,
            expire_time=%s,
            status='completed'
        WHERE id=%s
    """, (end_time, end_time, reservation_id))
    conn.commit()

    cursor.execute("""
        UPDATE stations
        SET reserved_slots = GREATEST(0, reserved_slots - 1)
        WHERE id=%s
    """, (station_id,))
    conn.commit()

    cursor.close()
    conn.close()

    # WS notify
    socketio.emit("charging_stopped", {
        "reservation_id": reservation_id,
        "station_id": station_id,
        "end_time": end_time.isoformat(),
        "stopped_by": "user" if is_user else "owner"
    })

    return jsonify({
        "message": "Charging stopped",
        "stopped_by": "user" if is_user else "owner",
        "charging_status": "completed",
        "charging_end_time": end_time.isoformat()
    })


# ===============================================================
# 📊 OWNER ANALYTICS
# ===============================================================
@owner_bp.route("/analytics/overview", methods=["GET"])
def owner_overview():
    owner_id, _ = get_auth_info()
    if not owner_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total FROM stations WHERE owner_id=%s", (owner_id,))
    total_stations = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM reservations r
        JOIN stations s ON r.station_id = s.id
        WHERE s.owner_id=%s
    """, (owner_id,))
    total_res = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT SUM(amount) AS revenue
        FROM payments
        WHERE station_id IN (SELECT id FROM stations WHERE owner_id=%s)
    """, (owner_id,))
    revenue = cursor.fetchone()["revenue"] or 0

    cursor.close()
    conn.close()

    return jsonify({
        "total_stations": total_stations,
        "total_reservations": total_res,
        "total_revenue": float(revenue)
    })


# ===============================================================
# ⭐ OWNER LOGS (fake reviews)
# ===============================================================
@owner_bp.route("/analytics/reviews", methods=["GET"])
def owner_reviews():
    owner_id, _ = get_auth_info()

    if not owner_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT s.name AS station_name,
               u.username,
               r.id AS reservation_id,
               r.created_at
        FROM reservations r
        JOIN stations s ON r.station_id = s.id
        JOIN users u ON r.user_id = u.id
        WHERE s.owner_id=%s
        ORDER BY r.created_at DESC
        LIMIT 20
    """, (owner_id,))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    reviews = [{
        "station_name": row["station_name"],
        "username": row["username"],
        "rating": 5,
        "review_text": f"Visited on {row['created_at']}",
    } for row in rows]

    return jsonify(reviews), 200
